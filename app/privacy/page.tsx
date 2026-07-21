import type { Metadata } from "next";
import { LegalPage } from "@/components/app/legal-page";

export const metadata: Metadata = {
  title: "Politica de Privacidade | Maya",
  description: "Politica de privacidade do Maya."
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politica de Privacidade"
      description="Esta pagina explica como o Maya trata dados financeiros, mensagens e comprovantes enviados pelos usuarios."
      updatedAt="14 de julho de 2026"
      sections={[
        {
          title: "Dados utilizados",
          paragraphs: [
            "O Maya usa dados cadastrados pelo usuario, como receitas, despesas, metas, orcamentos, datas, categorias e observacoes financeiras.",
            "Quando o usuario envia uma imagem de nota ou comprovante, a imagem pode ser processada pela MAYA para gerar um rascunho revisavel de despesa.",
            "Nesta etapa, o sistema nao deve salvar uma despesa extraida de imagem sem confirmacao humana."
          ]
        },
        {
          title: "Finalidade",
          paragraphs: [
            "Os dados sao utilizados para organizar a vida financeira do casal, calcular indicadores, comparar meses, apoiar metas e gerar orientacoes da MAYA.",
            "Mensagens recebidas pelo WhatsApp sao usadas apenas para identificar imagens de comprovantes e responder com orientacao de revisao."
          ]
        },
        {
          title: "Compartilhamento",
          paragraphs: [
            "O Maya nao vende dados pessoais ou financeiros.",
            "Quando recursos de IA estiverem configurados, informacoes necessarias podem ser enviadas ao provedor de IA apenas para executar a leitura solicitada.",
            "Chaves, tokens e segredos ficam somente em ambiente seguro de servidor."
          ]
        },
        {
          title: "Retencao e controle",
          paragraphs: [
            "O usuario pode exportar backup e limpar cadastros dentro do aplicativo.",
            "Imagens otimizadas de comprovantes podem ser preservadas junto dos lancamentos confirmados para consulta posterior em aparelhos autorizados."
          ]
        },
        {
          title: "Contato",
          paragraphs: [
            "Para duvidas sobre privacidade, exclusao de dados ou suporte, entre em contato pelo e-mail: deyversonsilvaf@gmail.com."
          ]
        }
      ]}
    />
  );
}
