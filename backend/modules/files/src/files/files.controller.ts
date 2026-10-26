import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { envelope } from '@elyvion/shared';
import { Response } from 'express';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Kein Feld "file" im multipart-Body gefunden.');
    return envelope(await this.files.upload(file.buffer, file.originalname, file.mimetype));
  }

  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.files.download(id);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename)}"`,
    });
    file.stream.pipe(res);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.files.remove(id);
    return envelope({ removed: true });
  }
}
