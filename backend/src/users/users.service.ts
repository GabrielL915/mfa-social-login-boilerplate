import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Provider, User } from './user.entity';

/**
 * Repositório em memória só pra o boilerplate rodar.
 * Substituir pelos métodos equivalentes no seu ORM.
 */
@Injectable()
export class UsersService {
  private users: User[] = [];

  async findByEmail(email: string) {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id);
  }

  async create(data: Omit<User, 'id' | 'mfaEnabled'>) {
    const user: User = { id: randomUUID(), mfaEnabled: false, ...data };
    this.users.push(user);
    return user;
  }

  async update(id: string, patch: Partial<User>) {
    const u = await this.findById(id);
    Object.assign(u, patch);
    return u;
  }

  /** Acha ou cria usuário vindo de login social, linkando por email. */
  async findOrCreateSocial(p: { provider: Provider; providerId: string; email: string; name?: string }) {
    let user = await this.findByEmail(p.email);
    if (!user) {
      user = await this.create({ email: p.email, name: p.name, provider: p.provider, providerId: p.providerId });
    }
    return user;
  }
}
