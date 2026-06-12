import { describe, it, expect } from "vitest";
import { maskPhone, maskEmail, maskName } from "@/lib/pii";

// ---------------------------------------------------------------------------
// maskPhone
// ---------------------------------------------------------------------------

describe("maskPhone", () => {
  it("PII-P1: mascara telefone brasileiro E.164 preservando comprimento", () => {
    // +5531999998888 = 14 chars → +5531 (5) + ***** (5) + 8888 (4)
    expect(maskPhone("+5531999998888")).toBe("+5531*****8888");
  });

  it("PII-P2: mascara telefone 13 dígitos (sem nono dígito)", () => {
    // +553199998888 = 13 chars → +5531 (5) + **** (4) + 8888 (4)
    expect(maskPhone("+553199998888")).toBe("+5531****8888");
  });

  it("PII-P3: mascara telefone internacional EUA E.164", () => {
    // +14155552671 = 12 chars → +1415 (5) + *** (3) + 2671 (4)
    expect(maskPhone("+14155552671")).toBe("+1415***2671");
  });

  it("PII-P4: preserva comprimento original do telefone", () => {
    const phone = "+5511987654321";
    expect(maskPhone(phone)).toHaveLength(phone.length);
  });

  it("PII-P5: telefone muito curto (< 9 chars) retorna mascarado com últimos 2", () => {
    // +12345 = 6 chars < 9 → mask tudo exceto últimos 2: ****45
    expect(maskPhone("+12345")).toBe("****45");
  });

  it("PII-P6: string vazia retorna vazia", () => {
    expect(maskPhone("")).toBe("");
  });

  it("PII-P7: telefone de 9 chars mostra prefixo 5 + sufixo 4 + zero asteriscos", () => {
    // 123456789 = 9 chars → 12345 + (9-9=0 asteriscos) + 6789
    expect(maskPhone("123456789")).toBe("123456789");
  });

  it("PII-P8: telefone de 10 chars → 1 asterisco no meio", () => {
    // 1234567890 = 10 chars → 12345 + * + 7890
    expect(maskPhone("1234567890")).toBe("12345*7890");
  });
});

// ---------------------------------------------------------------------------
// maskEmail
// ---------------------------------------------------------------------------

describe("maskEmail", () => {
  it("PII-E1: mascara email preservando primeiro char e domínio", () => {
    expect(maskEmail("joao@gmail.com")).toBe("j***@gmail.com");
  });

  it("PII-E2: mascara email com local longo", () => {
    expect(maskEmail("mariaclara.santos@empresa.com.br")).toBe("m***@empresa.com.br");
  });

  it("PII-E3: email com local de 1 char retorna sem alteração", () => {
    expect(maskEmail("a@b.com")).toBe("a@b.com");
  });

  it("PII-E4: string sem @ retorna original", () => {
    expect(maskEmail("sematsign")).toBe("sematsign");
  });

  it("PII-E5: string vazia retorna vazia", () => {
    expect(maskEmail("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// maskName
// ---------------------------------------------------------------------------

describe("maskName", () => {
  it("PII-N1: mascara sobrenome preservando nome e inicial", () => {
    expect(maskName("João Silva")).toBe("João S***");
  });

  it("PII-N2: nome composto usa último sobrenome", () => {
    expect(maskName("Maria Clara Santos")).toBe("Maria S***");
  });

  it("PII-N3: nome único mostra primeiros 2 chars", () => {
    expect(maskName("João")).toBe("Jo***");
  });

  it("PII-N4: string vazia retorna vazia", () => {
    expect(maskName("")).toBe("");
  });

  it("PII-N5: nome com espaços extras é tratado corretamente", () => {
    expect(maskName("  Ana  Lima  ")).toBe("Ana L***");
  });
});
