import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { SsoConnection } from './sso-connection.entity';

/**
 * Em memoria so pro boilerplate. Em prod: tabela sso_connections (domain UNIQUE).
 * Pra dev, carrega no boot o arquivo SSO_CONNECTIONS_FILE (default backend/sso-connections.local.json),
 * que o wizard setup-sso.sh preenche. Esse arquivo tem secrets: esta no .gitignore.
 */
@Injectable()
export class SsoConnectionsService implements OnModuleInit {
  private readonly log = new Logger('SsoConnections');
  private items: SsoConnection[] = [];

  onModuleInit() {
    const file = resolve(process.env.SSO_CONNECTIONS_FILE ?? 'sso-connections.local.json');
    if (!existsSync(file)) return;
    try {
      const list = JSON.parse(readFileSync(file, 'utf-8')) as Omit<SsoConnection, 'id'>[];
      for (const c of list) this.create(c);
      this.log.log(`${list.length} conexao(oes) SSO carregada(s) de ${file}`);
    } catch (e) {
      this.log.error(`Falha lendo ${file}: ${(e as Error).message}`);
    }
  }

  list() {
    return this.items.map((c) => this.safe(c));
  }

  create(input: Omit<SsoConnection, 'id'> & { id?: string }) {
    const conn = { id: input.id ?? randomUUID(), ...input, domain: input.domain.toLowerCase() } as SsoConnection;
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
