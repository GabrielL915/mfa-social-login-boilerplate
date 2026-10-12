import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Provider, User } from './user.entity';

/**
 * Repositorio em memoria so pra o boilerplate rodar.
 * Substituir pelos metodos equivalentes no seu ORM (cpf e email UNIQUE).
 */
@Injectable()
export class UsersService {
  private users: User[] = [];

  async findByEmail(email: string) {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async findByCpf(cpf: string) {
    return this.users.find((u) => u.cpf === cpf);
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

  async delete(id: string) {
    this.users = this.users.filter((u) => u.id !== id);
  }

  /**
   * Login social/SSO: acha pelo email ou cria. Usuario criado aqui nao tem CPF,
   * entao o AuthService vai exigir "completar cadastro" antes de liberar.
   */
  async findOrCreateSocial(p: { provider: Provider; providerId: string; email: string; name?: string }) {
    let user = await this.findByEmail(p.email);
    if (!user) {
      user = await this.create({ email: p.email, name: p.name, provider: p.provider, providerId: p.providerId });
    }
    return user;
  }

  /** Vincula um login social a uma conta existente (apos provar a senha). */
  async linkProvider(userId: string, provider: Provider, providerId: string) {
    const u = await this.findById(userId);
    const linked = u.linkedProviders ?? [];
    if (!linked.some((l) => l.provider === provider && l.providerId === providerId)) {
      linked.push({ provider, providerId });
    }
    return this.update(userId, { linkedProviders: linked });
  }
}
