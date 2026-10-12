import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SsoConnection } from './sso-connection.entity';

/** Em memoria so pro boilerplate. Em prod: tabela sso_connections (domain UNIQUE). */
@Injectable()
export class SsoConnectionsService {
  private items: SsoConnection[] = [];

  list() {
    return this.items.map((c) => this.safe(c));
  }

  create(input: Omit<SsoConnection, 'id'>) {
    const conn = { id: randomUUID(), ...input, domain: input.domain.toLowerCase() } as SsoConnection;
    this.items = this.items.filter((c) => c.domain !== conn.domain);
    this.items.push(conn);
    return this.safe(conn);
  }

  byId(id: string) {
    const c = this.items.find((c) => c.id === id);
    if (!c) throw new NotFoundException('Conexao SSO nao encontrada');
    return c;
  }

  byEmail(email: string) {
    const domain = email.split('@')[1]?.toLowerCase();
    return this.items.find((c) => c.domain === domain) ?? null;
  }

  /** Remove segredos antes de devolver pra API. */
  private safe(c: SsoConnection) {
    if (c.type === 'oidc') return { ...c, oidc: { ...c.oidc, clientSecret: '***' } };
    return c;
  }
}
