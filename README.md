# MFA + Login Social (NestJS + React)

Boilerplate funcional: **CPF + senha** + TOTP (Google Authenticator etc.), Google, Microsoft e Apple via Passport, e SSO corporativo (OIDC/SAML).

## Rodar

```bash
cd backend && cp .env.example .env && npm i && npm run start:dev
cd frontend && cp .env.example .env && npm i && npm run dev
```

Usuarios ficam em memoria (`backend/src/users/users.service.ts`). Trocar os 5 metodos pelo seu ORM.

## Fluxo

1. 1o fator: `POST /auth/login { cpf, password }`, redirect `GET /auth/{google|microsoft|apple}`, ou SSO.
2. Backend chama `issueAfterPrimaryAuth(user)`, que devolve um `step`:
   - `profile` -> `{ profileToken }`: usuario veio de social/SSO e ainda nao tem CPF
   - `mfa` -> `{ mfaToken }`: 2o fator (JWT de 5 min, secret separado)
   - `done` -> `{ accessToken }`
3. Front: `profile` -> `/complete-profile`; `mfa` -> `/mfa` e `POST /auth/mfa/verify { mfaToken, code }`.
4. Social/SSO: backend redireciona pra `FRONTEND_URL/auth/callback?profileToken=|mfaToken=|accessToken=`.

## CPF como identificador

- Login e por CPF (normalizado pra 11 digitos, digito verificador validado, UNIQUE). Email continua obrigatorio no cadastro: e por ele que social/SSO linkam a conta e e o rotulo no app autenticador.
- CPF nunca vai no JWT nem em URL. `/auth/me` devolve mascarado (`***.456.789-**`). Em prod, considerar criptografar em repouso.
- **Completar cadastro:** Google/Microsoft/Apple/SSO nao devolvem CPF. Na 1a entrada o usuario e criado sem CPF e cai em `POST /auth/profile/complete { profileToken, cpf }`.
- **Vinculo de conta:** se o CPF informado ja pertence a outra conta, responde `409 { code: "CPF_IN_USE", canLink }`. O front pede a **senha daquela conta** e chama `POST /auth/profile/link { profileToken, cpf, password }`. Com a senha certa o login social e vinculado a conta existente (a temporaria e apagada) e o MFA dela continua valendo. Sem exigir a senha, qualquer um que soubesse um CPF sequestraria a conta via Google.

Ativar MFA (logado): `POST /auth/mfa/setup` (QR) -> `POST /auth/mfa/enable { code }` (retorna 8 recovery codes).

## Endpoints

| Metodo | Rota | Auth |
|---|---|---|
| POST | /auth/register `{ cpf, email, password, name }` | - |
| POST | /auth/login `{ cpf, password }` | - |
| POST | /auth/profile/complete `{ profileToken, cpf }` | - |
| POST | /auth/profile/link `{ profileToken, cpf, password }` | - |
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
bash backend/setup-oauth.sh        # Git Bash / Linux / macOS
.ackend\setup-oauth.ps1          # PowerShell (chama o Git Bash)
```

- **Google**: console.cloud.google.com -> Credentials -> OAuth Client (Web). Redirect: `BACKEND_URL/auth/google/callback`.
- **Microsoft**: portal.azure.com -> App registrations -> Web redirect `BACKEND_URL/auth/microsoft/callback`. Tenant `common` aceita conta pessoal + corporativa.
- **Apple**: developer.apple.com -> Services ID (= `APPLE_CLIENT_ID`), Sign in with Apple habilitado, Key (.p8) -> `APPLE_KEY_ID` + `APPLE_PRIVATE_KEY`. Apple exige HTTPS e dominio verificado, nao funciona em localhost (usar ngrok). Nome do usuario so vem na 1a autorizacao.

## Bypass de desenvolvimento

Pra testar o funil sem app autenticador nem IdP real, no `backend/.env`:

```
DEV_AUTH_BYPASS=true
```

- **MFA:** o codigo `000000` vale como TOTP (ativar, verificar, desativar). Codigos errados continuam rejeitados.
- **SSO:** email de dominio sem conexao cadastrada entra por um IdP fake interno (`/sso/dev/callback`) e cai no mesmo funil (completar CPF -> MFA -> logado).

Seguranca: so funciona com `NODE_ENV != production`. Com `DEV_AUTH_BYPASS=true` e `NODE_ENV=production` o backend **recusa subir**. Com o flag desligado a rota dev nem existe (404).

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
