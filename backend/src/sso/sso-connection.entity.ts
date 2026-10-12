/**
 * Uma "conexao SSO" = um cliente/empresa com seu proprio IdP.
 * Roteamento: o dominio do email do usuario decide qual conexao usar.
 */
export interface OidcConfig {
  issuer: string;       // ex: https://login.microsoftonline.com/<tenantId>/v2.0 | https://<org>.okta.com
  clientId: string;
  clientSecret: string;
  scope?: string;       // default: openid profile email
}

export interface SamlConfig {
  entryPoint: string;   // SSO URL do IdP (HTTP-Redirect binding)
  idpCert: string;      // certificado X.509 do IdP (PEM ou base64 puro)
  issuer?: string;      // entityID do nosso SP; default BACKEND_URL/sso/saml/metadata/<id>
}

export type SsoConnection =
  | { id: string; domain: string; name: string; type: 'oidc'; oidc: OidcConfig }
  | { id: string; domain: string; name: string; type: 'saml'; saml: SamlConfig };
