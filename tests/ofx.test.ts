import { describe, expect, it } from "vitest";
import { ofxLinesToTransactions, parseOfx } from "@/modules/finance/lib/ofx";

describe("OFX", () => {
  it("le linhas e preserva FITID para evitar reimportacao", () => {
    const draft = parseOfx(`OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>001<ACCTID>12345</BANKACCTFROM><BANKTRANLIST><DTSTART>20260901000000<DTEND>20260930235959<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260910120000<TRNAMT>-118.47<FITID>agua-1<NAME>SAERP<MEMO>Conta de agua</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260907120000<TRNAMT>2800.00<FITID>salario-1<NAME>Salario</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>990.16</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`);
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0]).toMatchObject({ type: "expense", amount: 118.47, externalId: "agua-1", date: "2026-09-10" });
    expect(draft.closingBalance).toBe(990.16);
    const tx = ofxLinesToTransactions(draft);
    expect(tx[0].institutionId).toBe("001:12345");
    expect(tx[0].externalId).toBe("agua-1");
  });
});
