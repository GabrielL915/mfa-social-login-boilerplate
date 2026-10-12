/** Normaliza pra 11 digitos. Devolve null se invalido (formato ou digito verificador). */
export function normalizeCpf(input: string): string | null {
  const d = (input ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  if (calc(9) !== Number(d[9]) || calc(10) !== Number(d[10])) return null;
  return d;
}

/** 12345678901 -> ***.456.789-** (pra respostas da API e logs). */
export function maskCpf(cpf?: string) {
  if (!cpf) return undefined;
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
