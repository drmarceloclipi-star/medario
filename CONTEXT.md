# Medário — Glossário do domínio

Glossário do domínio Medário. Termos resolvidos durante a entrevista de planejamento. Sem detalhes de implementação.

## Diretório e perfis

**Medário**:
Catálogo médico digital nascido em Joinville/SC. Conecta pacientes a médicos com informações verificáveis e ajuda médicos a serem encontrados localmente.

**Card preview**:
Card minimalista de médico exibido na home como teaser. Não é o Card completo do diretório.

**Card completo**:
Card de médico exibido no diretório. Reúne identidade, especialidade, CRM, RQE quando aplicável, locais, modalidades, convênios, disponibilidade, selos e ações de contato.
_Evitar_: DoctorCard

**Compatibilidade factual**:
Correspondência entre Perfil médico e critérios objetivos da busca, como convênio, distância, modalidade ou Vaga confirmada. Não infere condição de saúde nem qualidade médica.

**Dado atualizado**:
Informação factual de Perfil médico acompanhada da data de confirmação ou atualização. Dado vencido perde destaque e não sustenta afirmação de disponibilidade ou Convênio confirmado.

**Perfil verificado**:
Selo de confiança que indica dados conferidos pelo Medário. Não implica ranqueamento de qualidade médica.

**Perfil reivindicado**:
Status em que o próprio médico assumiu autoria e controle do Perfil médico. É diferente de Perfil verificado, que valida dados.

**Alteração em revisão**:
Mudança proposta em CRM, RQE, convênio, Local de atendimento, disponibilidade ou contato. O Perfil público preserva o último dado confirmado até a conferência.

**Foto profissional autorizada**:
Foto fornecida ou autorizada pelo médico para seu Perfil médico. Não inclui imagem gerada para representar profissional real.

**CRM conferido**:
Selo que indica conferência da existência e consistência do CRM.

**RQE informado**:
Selo que indica RQE declarado pelo profissional. Declaração não equivale a validação.

**URL pública do Perfil médico**:
Endereço público estável associado ao Perfil médico. Mudança de nome não troca a URL publicada; exceções preservam a anterior por redirecionamento permanente.

**Dossiê profissional**:
Metáfora para o Perfil médico público: credenciais, locais, agendamento, foco clínico e verificação, sem aparência de bio de rede social.

## Busca e resultados

**Busca interpretada**:
Tradução editável de linguagem natural para filtros objetivos do diretório. Em relato não urgente, pode seguir sem confirmação adicional.

**Busca compartilhável**:
Busca cuja URL contém apenas filtros derivados, como especialidade, cidade, convênio e modalidade. Nunca contém texto livre, sintomas ou outros sinais de saúde.

**Sugestão geral**:
Sugestão de busca disponível a qualquer pessoa e sem dados pessoais.

**Sugestão personalizada**:
Sugestão baseada em interesses derivados do paciente. Exige Consentimento em duas camadas.

**Histórico de busca**:
Registro revogável de buscas anteriores. Antes do consentimento, não persiste termos que revelem sintomas; após consentimento, expira em 90 dias e pode ser apagado a qualquer momento.

**Perfil de afinidade**:
Score por especialidade gerado a partir de Interesses derivados. Só é usado para Personalização de busca após consentimento.

**Personalização de busca**:
Ajuste opcional da ordem dos resultados por Perfil de afinidade. O paciente pode desligá-lo.

**Interesse derivado**:
Especialidade agregada de buscas sem guardar seus termos brutos. É resultado do processamento, não o insumo.

**Busca sem resultado**:
Busca sem Perfil médico compatível. Oferece alternativas de filtro, modalidade, raio ou Lista de espera; não inventa resultados, não atualiza afinidade e não cria alerta automaticamente.

**Ordem orgânica**:
Ordem dos resultados não patrocinados. Prioriza filtros exatos, depois distância, disponibilidade e atualidade dos dados; não expressa qualidade médica.

**Plano patrocinado**:
Posicionamento pago em bloco separado, rotulado antes do clique. Não altera verificação, identidade ou Ordem orgânica.

**Convênio confirmado**:
Convênio aceito para combinação específica de médico, Local de atendimento e modalidade. Não inclui simples possibilidade de reembolso.

**Convênio informado**:
Convênio declarado sem confirmação atual para a combinação aplicável. Deve orientar o paciente a confirmar antes do atendimento.

## Localização e comparação

**Local de atendimento**:
Consultório, clínica ou outro local profissional onde o médico atende presencialmente.

**Local de atendimento autorizado**:
Local cuja localização exata pode ser exibida porque médico ou clínica responsável a autorizou.

**Localização do paciente**:
Posição geográfica usada como origem para proximidade, distância e rotas. Requer autorização explícita e permanece somente na sessão ou consulta atual.

**Consulta de mapa**:
Mesma consulta que alimenta a lista de resultados, apresentada espacialmente pelos Locais de atendimento. Navegar pelo mapa só altera a consulta quando o paciente escolhe buscar naquela área.

**Rota externa**:
Encaminhamento para serviço de mapas externo responsável pela navegação. O Medário não oferece navegação curva a curva.

**Degradação do mapa**:
Estado em que o mapa está indisponível, mas lista e filtros continuam permitindo encontrar perfis.

**Comparação orientada por critérios**:
Comparação de até três médicos pelos critérios escolhidos pelo paciente. Pode explicar compatibilidade; não declara melhor médico.

## Agenda e contato

**Contato externo**:
Transição para canal de contato verificado do médico, como WhatsApp ou telefone. Não é conversa hospedada pelo Medário.

**Orquestrador de agendamento**:
Capacidade do Medário que controla regras, estados e transições de agendamentos. É fonte operacional dos agendamentos que cria.

**Tipo de consulta**:
Configuração reservável definida pelo médico: modalidade, duração, preço opcional, antecedência mínima, janela máxima de reserva e Política de confirmação.

**Slot**:
Unidade reservável associada a médico, Local de atendimento, modalidade e duração. Pode estar aberto, bloqueado ou reservado.

**Slot elegível**:
Slot aberto pela regra do Medário e sem Conflito externo. É o único Slot que pode ser oferecido ao paciente.

**Vaga confirmada**:
Horário específico e reservável confirmado para médico, modalidade e local determinados.

**Aceita novos pacientes**:
Informação de que o médico recebe novos pacientes, sem afirmar vaga em data ou horário.

**Disponibilidade a confirmar**:
Estado sem dado atual suficiente para afirmar vaga. Não pode ser exibido como disponível.

**Política de confirmação**:
Regra definida pelo médico para uma reserva: confirmação imediata ou aprovação manual. O padrão é aprovação manual.

**Solicitação de agendamento**:
Pedido de reserva iniciado pelo paciente. Permanece pendente até ser aceito, recusado ou receber Proposta de novo horário, salvo quando a Política de confirmação permitir confirmação imediata.

**Reserva confirmada**:
Agendamento aceito pela Política de confirmação, com Slot reservado e evento criado na Agenda de integração.

**Proposta de novo horário**:
Alternativa de Slot oferecida em resposta a uma solicitação ou remarcação. Não confirma a reserva até o aceite do paciente.

**Política de cancelamento**:
Regra definida pelo médico para cancelamento, remarcação e eventual reembolso. É exibida antes da reserva e preservada no agendamento.

**Solicitação de cancelamento**:
Pedido de cancelamento que permanece pendente até a transição confirmada pelo Medário.

**Lista de espera**:
Conjunto ordenado de pacientes interessados em Slot ou critério de agenda. Vaga liberada gera convite temporário; ninguém é reservado automaticamente.

**Acesso de agendamento para visitante**:
Link seguro após validação de telefone ou e-mail, que permite gerir um agendamento sem criar conta.

**Resultado de atendimento**:
Estado final marcado pelo médico: realizado ou não compareceu. Não contém diagnóstico ou avaliação clínica.

**Teleconsulta externa**:
Modalidade remota apresentada com contato ou agenda. A chamada não é hospedada pelo Medário nesta fase.

**Lembrete de agendamento**:
Comunicação de Reserva confirmada por e-mail ou, com opt-in, WhatsApp. Contém somente horário, médico e Local de atendimento.

**Autorização de agenda**:
Permissão revogável do médico para consultar livre/ocupado da agenda externa escolhida e escrever na Agenda de integração.

**Agenda de integração**:
Agenda externa dedicada a receber eventos confirmados do Medário. Pode informar ocupação, mas não substitui o Orquestrador de agendamento.

**Evento mínimo de integração**:
Evento enviado à Agenda de integração com horário, duração e identificador do Medário. Não contém sintomas ou dados do paciente no título ou descrição.

**Frescor da agenda**:
Tempo desde a última confirmação da disponibilidade integrada. Após cinco minutos sem atualização, a disponibilidade passa a confirmar.

**Conflito externo**:
Ocupação detectada em agenda externa que impede oferecer ou confirmar Slot. Não altera silenciosamente a Reserva confirmada.

## Pessoas, contas e notificações

**Visitante**:
Pessoa que usa Medário sem conta. Pode pesquisar, favoritar e salvar buscas no dispositivo atual, sem sincronização entre dispositivos.

**Favorito**:
Referência de médico guardada para consulta posterior. Para visitante, existe apenas no dispositivo atual; para paciente com conta, pode ser sincronizada.

**Busca salva**:
Consulta e filtros guardados para repetição ou acompanhamento. Para visitante, existe apenas no dispositivo atual; para paciente com conta, pode ser sincronizada.

**Bifurcação de usuário**:
Ponto de entrada em que a pessoa se identifica como paciente ou médico. Paciente segue para preferências; médico segue para aquisição profissional.

**Preferência operacional**:
Dado logístico não sensível para refinar buscas: cidade/bairro, convênio, modalidade, idioma ou acessibilidade. Não inclui localização exata.

**Consentimento em duas camadas**:
Modelo em que cadastro básico não coleta dados sensíveis e a autorização para processar interesses de saúde é contextual à busca. Pode ser revogado.

**Recusa do consentimento de saúde**:
Decisão de não autorizar interpretação ou persistência de sintomas. Mantém busca por especialidade e filtros objetivos.

**Consentimento de telemetria**:
Autorização independente para analytics e monitoramento de falhas. Não condiciona uso, nem inclui texto de busca ou sinais de saúde.

**Preferência de notificação**:
Escolha granular de paciente com conta para receber atualizações sobre agendamentos, perfis e buscas salvas. Não expõe sintomas, especialidades ou diagnósticos na tela bloqueada.

**Alerta de busca salva**:
Notificação por mudança material: novo médico compatível, Convênio confirmado ou Vaga confirmada. Não é comunicação promocional.

## Medário Pro

**Conta profissional**:
Conta do Medário Pro pertencente a médico e vinculada ao seu próprio Perfil médico. Não representa clínica, equipe ou múltiplos perfis.

**Lead de contato**:
Sinal de intenção criado pela abertura de Contato externo. Para visitante, não identifica a pessoa e nunca contém texto de busca, sintomas ou localização exata.

**Lead identificado**:
Lead associado à identidade ou contato porque paciente enviou Solicitação de agendamento ou se identificou no Contato externo.

**Métrica de lead**:
Contagem agregada de sinais de intenção sem identidade. É a única visibilidade de leads de visitantes no Medário Pro.

**Diagnóstico de presença digital**:
Serviço gratuito que avalia presença online de médico ou clínica antes de plano pago.

## Busca por sintomas

**Orientação de busca**:
Resposta que converte necessidade narrada em especialidades, filtros ou próximos passos. Não é diagnóstico, prescrição, prognóstico ou recomendação de médico específico.

**Protocolo de alerta de urgência**:
Critérios clínicos revisados por médico que determinam quando relato gera Alerta de urgência. A IA pode aplicar o protocolo, mas não defini-lo sozinha.

**Alerta de urgência**:
Interrupção preventiva quando relato indica possível necessidade de atendimento imediato. Direciona ao serviço de urgência sem concluir causa clínica.

**Encaminhamento por sintomas**:
Aplicação da Orientação de busca a sintomas relatados. Para relato urgente, cede lugar ao Alerta de urgência.

## SEO local

**Diretório local indexável**:
Página pública de cidade ou especialidade com ao menos três Perfis médicos e conteúdo único. Combinação escassa é pesquisável, mas não entra em sitemap nem índice.

## Conceitos evitados

- **Avaliações de pacientes** — MVP não inclui reviews, estrelas ou rankings de qualidade médica.
- **Melhor médico / top physician** — linguagem de ranqueamento sem metodologia transparente é proibida.
- **Recomendado pelo Medário** — só permitido quando critérios são explícitos e publicados.
- **Diagnóstico pela IA** — IA orienta busca; não diagnostica, prescreve ou conclui causa clínica.

## Diálogo de exemplo

> Especialista: “Este Slot de teleconsulta está elegível?”
>
> Produto: “Sim. A regra do médico o abriu e a Agenda de integração não informou Conflito externo. A Reserva confirmada seguirá a Política de confirmação escolhida.”
