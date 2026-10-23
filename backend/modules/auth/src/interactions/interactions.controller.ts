import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Provider from 'oidc-provider';
import { OIDC_PROVIDER } from '../oidc/oidc.constants';
import { UsersService } from '../users/users.service';
import { renderConsentPage, renderLoginPage } from './interaction.views';

@Controller('interaction')
export class InteractionsController {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly provider: Provider,
    private readonly usersService: UsersService,
  ) {}

  @Get(':uid')
  async show(@Param('uid') _uid: string, @Req() req: Request, @Res() res: Response) {
    const { uid, prompt, params } = await this.provider.interactionDetails(req, res);

    if (prompt.name === 'login') {
      res.send(renderLoginPage({ uid, clientId: String(params.client_id ?? '') }));
      return;
    }

    if (prompt.name === 'consent') {
      res.send(renderConsentPage({ uid, scope: String(params.scope ?? '') }));
      return;
    }

    res.status(501).send(`Interaction prompt "${prompt.name}" is not implemented`);
  }

  @Post(':uid/login')
  async login(
    @Param('uid') uid: string,
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.usersService.verifyCredentials(
      body.email ?? '',
      body.password ?? '',
    );

    if (!user) {
      res.status(401).send(
        renderLoginPage({ uid, clientId: '', error: 'Invalid email or password' }),
      );
      return;
    }

    await this.provider.interactionFinished(
      req,
      res,
      { login: { accountId: user.id } },
      { mergeWithLastSubmission: false },
    );
  }

  @Post(':uid/confirm')
  async confirm(@Param('uid') _uid: string, @Req() req: Request, @Res() res: Response) {
    const interaction = await this.provider.interactionDetails(req, res);
    const { grantId } = interaction;

    const grant = grantId
      ? await this.provider.Grant.find(grantId)
      : new this.provider.Grant({
          accountId: interaction.session?.accountId,
          clientId: String(interaction.params.client_id),
        });

    if (!grant) {
      res.status(400).send('No grant found for this interaction');
      return;
    }

    if (interaction.prompt.details.missingOIDCScope) {
      grant.addOIDCScope((interaction.prompt.details.missingOIDCScope as string[]).join(' '));
    }
    if (interaction.prompt.details.missingOIDCClaims) {
      grant.addOIDCClaims(interaction.prompt.details.missingOIDCClaims as string[]);
    }

    const newGrantId = await grant.save();

    await this.provider.interactionFinished(
      req,
      res,
      { consent: { grantId: newGrantId } },
      { mergeWithLastSubmission: true },
    );
  }
}
