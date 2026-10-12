# MFA + Login Social (NestJS + React)

Boilerplate funcional: senha + TOTP (Google Authenticator etc.), Google, Microsoft e Apple via Passport.

## Rodar

```bash
cd backend && cp .env.example .env && npm i && npm run start:dev
cd frontend && cp .env.example .env && npm i && npm run dev
```

Usuarios ficam em memoria (`backend/src/users/users.service.ts`). Trocar os 5 metodos pelo seu ORM.

## Fluxo

1. 1o fator: `POST /auth/login` (senha) ou redirect `GET /auth/{google|microsoft|apple}`.
2. Backend chama `issueAfterPrimaryAuth(user)`:
   - sem MFA -> `{ accessToken }`
   - com MFA -> `{ mfaRequired: true, mfaToken }` (JWT de 5 min, secret separado)
3. Front manda pra `/mfa`, usuario digita TOTP, `POST /auth/mfa/verify { mfaToken, code }` -> `{ accessToken }`.
4. Social: backend redireciona pra `FRONTEND_URL/auth/callback?accessToken=...` ou `?mfaToken=...`.

Ativar MFA (logado): `POST /auth/mfa/setup` (QR) -> `POST /auth/mfa/enable { code }` (retorna 8 recovery codes).

## Endpoints

| Metodo | Rota | Auth |
|---|---|---|
| POST | /auth/register | - |
| POST | /auth/login | - |
| POST | /auth/mfa/verify | mfaToken no body |
| POST | /auth/mfa/setup | Bearer |
| POST | /auth/mfa/enable | Bearer |
| POST | /auth/mfa/disable | Bearer |
| GET | /auth/me | Bearer |
| GET | /auth/google, /auth/microsoft, /auth/apple | redirect |
| GET | /auth/google/callback, /auth/microsoft/callback | - |
| POST | /auth/apple/callback | - (Apple usa form_post) |

## Config dos providers

Wizard que abre cada console, mostra o callback exato e grava no `backend/.env`:

```bash
bash backend/setup-oauth.sh
```

- **Google**: console.cloud.google.com -> Credentials -> OAuth Client (Web). Redirect: `BACKEND_URL/auth/google/callback`.
- **Microsoft**: portal.azure.com -> App registrations -> Web redirect `BACKEND_URL/auth/microsoft/callback`. Tenant `common` aceita conta pessoal + corporativa.
- **Apple**: developer.apple.com -> Services ID (= `APPLE_CLIENT_ID`), Sign in with Apple habilitado, Key (.p8) -> `APPLE_KEY_ID` + `APPLE_PRIVATE_KEY`. Apple exige HTTPS e dominio verificado, nao funciona em localhost (usar ngrok). Nome do usuario so vem na 1a autorizacao.

## Antes de ir pra prod

- Criptografar `mfaSecret` no banco.
- Rate limit em `/auth/login` e `/auth/mfa/verify` (`@nestjs/throttler`).
- Refresh token em cookie httpOnly em vez de accessToken no localStorage.
- Passar token do social callback por cookie ou code de uso unico em vez de query string.
- Guardar `providerId` por provider e lidar com conflito de email entre providers.

## SSO corporativo (OIDC / SAML)

Diferente do social (conta pessoal do usuario), no SSO a **empresa** e o provedor: Azure AD do cliente, Okta, Google Workspace, Keycloak. Cada cliente vira uma **conexao SSO** ligada a um dominio de email. O fluxo cai no mesmo funil de MFA.

```
usuario digita maria@acme.com
  -> POST /sso/start            acha a conexao pelo dominio, devolve URL do IdP
  -> IdP autentica
  -> GET  /sso/oidc/callback    (ou POST /sso/saml/callback/:id)
  -> issueAfterPrimaryAuth      MFA se ativo, senao accessToken
  -> FRONTEND_URL/auth/callback
```

| Metodo | Rota | Auth |
|---|---|---|
| POST | /sso/start `{ email }` | - |
| GET | /sso/start/:connectionId | redirect |
| GET | /sso/oidc/callback | - |
| POST | /sso/saml/callback/:connectionId | - |
| GET | /sso/saml/metadata/:connectionId | - (XML pro IdP importar) |
| GET/POST | /sso/connections | Bearer (em prod: role admin) |

Registrar uma conexao OIDC (Azure AD de um cliente):

```json
POST /sso/connections
{
  "domain": "acme.com", "name": "Acme", "type": "oidc",
  "oidc": {
    "issuer": "https://login.microsoftonline.com/<TENANT_ID>/v2.0",
    "clientId": "...", "clientSecret": "..."
  }
}
```

Redirect URI pra cadastrar no IdP: `BACKEND_URL/sso/oidc/callback`. Okta: issuer `https://<org>.okta.com`. Google Workspace: `https://accounts.google.com`. Keycloak: `https://<host>/realms/<realm>`.

Registrar SAML:

```json
{
  "domain": "acme.com", "name": "Acme", "type": "saml",
  "saml": { "entryPoint": "https://idp.acme.com/sso/saml", "idpCert": "MIIC..." }
}
```

ACS URL: `BACKEND_URL/sso/saml/callback/<connectionId>`; entityID/metadata: `BACKEND_URL/sso/saml/metadata/<connectionId>`.

Seguranca ja embutida: PKCE + nonce + state assinado (JWT 10 min), e o email retornado pelo IdP **precisa** ser do dominio da conexao (um IdP nao consegue afirmar email de outra empresa).

Testado: OIDC de ponta a ponta contra um IdP mock (`oauth2-mock-server`), com e sem MFA. SAML compila mas nao foi testado contra IdP real.
