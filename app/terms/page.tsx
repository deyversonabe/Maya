import type { Metadata } from "next";
import { LegalPage } from "@/components/app/legal-page";

export const metadata: Metadata = {
  title: "Termos de Servico | Maya",
  description: "Termos de servico do Maya."
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Servico"
      description="Estes termos descrevem as regras gerais de uso do Maya."
      updatedAt="14 de julho de 2026"
      sections={[
        {
          title: "Uso do aplicativo",
          paragraphs: [
            "O Maya e uma ferramenta de organizacao financeira pessoal e familiar.",
            "O usuario e responsavel por revisar dados cadastrados, rascunhos de comprovantes e informacoes financeiras antes de tomar decisoes."
          ]
        },
        {
          title: "MAYA",
          paragraphs: [
            "A MAYA e uma assistente financeira de apoio. Ela organiza informacoes, aponta padroes e sugere proximos passos com base nos dados cadastrados.",
            "A MAYA nao substitui consultoria financeira, contabil, juridica ou de investimentos."
          ]
        },
        {
          title: "Comprovantes e WhatsApp",
          paragraphs: [
            "Fotos de notas e comprovantes podem gerar rascunhos de despesas.",
            "Nenhum rascunho vindo de imagem ou WhatsApp deve ser tratado como lancamento final sem revisao e confirmacao do usuario."
          ]
        },
        {
          title: "Disponibilidade",
          paragraphs: [
            "O sistema pode passar por manutencoes, ajustes e evolucoes.",
            "Recursos dependentes de terceiros, como WhatsApp, Vercel, provedores de IA e servicos de banco de dados, podem sofrer indisponibilidades externas."
          ]
        },
        {
          title: "Contato",
          paragraphs: [
            "Para suporte ou duvidas sobre estes termos, entre em contato pelo e-mail: mayajuntosia@gmail.com."
          ]
        }
      ]}
    />
  );
}
