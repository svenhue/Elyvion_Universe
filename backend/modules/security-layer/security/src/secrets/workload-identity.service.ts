import { Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export interface SecretWorkloadIdentity {
  id: string;
  tenantIds: string[];
  environmentIds: string[];
  workspaceIds: string[];
  adapterIds: string[];
}

interface WorkloadCredential {
  token: string;
  tenantIds: string[];
  environmentIds: string[];
  workspaceIds: string[];
  adapterIds: string[];
}

@Injectable()
export class WorkloadIdentityService {
  async authenticate(
    workloadId: string | undefined,
    providedToken: string | string[] | undefined,
  ): Promise<SecretWorkloadIdentity> {
    if (!workloadId || typeof providedToken !== 'string') {
      throw new UnauthorizedException('Workload authentication is required.');
    }

    const credentialFile = process.env.SECRET_STORE_WORKLOAD_CREDENTIALS_FILE;
    if (!credentialFile) {
      throw new UnauthorizedException('Workload identities are not configured.');
    }

    let credentials: Record<string, WorkloadCredential>;
    try {
      const parsed: unknown = JSON.parse(await readFile(credentialFile, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      credentials = parsed as Record<string, WorkloadCredential>;
    } catch {
      throw new UnauthorizedException('Workload identities are unavailable.');
    }

    const credential = credentials[workloadId];
    if (!isCredential(credential) || !constantTimeEqual(credential.token, providedToken)) {
      throw new UnauthorizedException('Invalid workload credentials.');
    }
    return {
      id: workloadId,
      tenantIds: credential.tenantIds,
      environmentIds: credential.environmentIds,
      workspaceIds: credential.workspaceIds,
      adapterIds: credential.adapterIds,
    };
  }
}

function isCredential(value: unknown): value is WorkloadCredential {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record['token'] === 'string' && record['token'].length > 0 &&
    isStringArray(record['tenantIds']) &&
    isStringArray(record['environmentIds']) &&
  record['environmentIds'].length === 1 &&
  isStringArray(record['workspaceIds']) &&
    isStringArray(record['adapterIds']);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
}

function constantTimeEqual(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);
}
