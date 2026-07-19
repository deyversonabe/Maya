import type { Metadata } from "next";
import { LegalPage } from "@/components/app/legal-page";

export const metadata: Metadata = {
  title: "Exclusao de Dados | Juntos Maya",
  description: "Instrucoes para solicitar exclusao de dados no Juntos Maya."
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Exclusao de Dados"
      description="Esta pagina informa como solicitar a exclusao de dados relacionados ao Juntos Maya."
      updatedAt="14 de julho de 2026"
      sections={[
        {
          title: "Como excluir dados no aplicativo",
          paragraphs: [
            "No app, acesse Dados e use a opcao de limpar cadastros quando quiser remover as informacoes financeiras salvas no dispositivo.",
            "Antes de limpar cadastros, recomendamos exportar um backup caso queira guardar uma copia."
          ]
        },
        {
          title: "Solicitacao por e-mail",
          paragraphs: [
            "Para solicitar exclusao de dados associados ao seu contato, envie um e-mail para mayajuntosia@gmail.com com o assunto: Exclusao de dados - Juntos Maya.",
            "Informe o telefone ou e-mail usado no contato com o Juntos Maya para que possamos localizar a solicitacao.",
            "Nunca envie senhas, tokens, documentos completos ou informacoes financeiras sensiveis por e-mail."
          ]
        },
        {
          title: "WhatsApp",
          paragraphs: [
            "Mensagens recebidas pelo WhatsApp podem ser usadas para processar comprovantes e responder ao usuario.",
            "Caso queira solicitar exclusao de registros relacionados ao WhatsApp, informe o numero de telefone usado no contato."
          ]
        },
        {
          title: "Prazo",
          paragraphs: [
            "As solicitacoes serao analisadas e tratadas em prazo razoavel, considerando validacao de identidade, seguranca e obrigacoes legais aplicaveis.",
            "Quando a exclusao depender de servicos de terceiros, poderemos orientar etapas adicionais."
          ]
        }
      ]}
    />
  );
}
