import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import { Server } from "socket.io";

// Type augmentation
import "./types.js";

// Import plugins
import authenticatePlugin from "./plugins/authenticate.js";

// Import routes
import { authRoutes } from "./modules/auth/routes.js";
import { conversationRoutes } from "./modules/conversations/routes.js";
import { contactRoutes } from "./modules/contacts/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { personaRoutes } from "./modules/personas/routes.js";
import { knowledgeRoutes } from "./modules/knowledge/routes.js";
import { webhookRoutes } from "./modules/webhooks/routes.js";
import { whatsappRoutes } from "./modules/whatsapp/routes.js";
import { automationRoutes } from "./modules/automations/routes.js";
import { triggerRoutes } from "./modules/triggers/routes.js";
import { crmRoutes } from "./modules/crm/routes.js";
import { startAutomationScheduler, stopAutomationScheduler } from "./services/automation.service.js";
import { startRemarketingScheduler, stopRemarketingScheduler, setRemarketingEventCallback } from "./services/remarketing.service.js";
import { testEmailConnection, sendTestEmail } from "./services/email.service.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const privacyPageHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Watson AI - Politica de Privacidade</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.7}
.header{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;padding:3rem 1rem;text-align:center}
.header h1{font-size:2rem;margin-bottom:.5rem}
.header p{opacity:.9;font-size:1.1rem}
.container{max-width:800px;margin:0 auto;padding:2rem 1.5rem}
.section{background:#fff;border-radius:12px;padding:2rem;margin-bottom:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.section h2{color:#2563eb;font-size:1.3rem;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:2px solid #e2e8f0}
.section p,.section li{color:#475569;margin-bottom:.8rem}
.section ul{padding-left:1.5rem}
.section li{margin-bottom:.5rem}
.delete-section{border:2px solid #ef4444;background:#fef2f2}
.delete-section h2{color:#dc2626;border-bottom-color:#fecaca}
.form-group{margin-bottom:1rem}
.form-group label{display:block;font-weight:600;margin-bottom:.4rem;color:#374151}
.form-group input{width:100%;padding:.75rem 1rem;border:1px solid #d1d5db;border-radius:8px;font-size:1rem}
.form-group input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.btn-delete{background:#dc2626;color:#fff;border:none;padding:.75rem 2rem;font-size:1rem;font-weight:600;border-radius:8px;cursor:pointer;width:100%}
.btn-delete:hover{background:#b91c1c}
.btn-delete:disabled{background:#9ca3af;cursor:not-allowed}
.status-msg{margin-top:1rem;padding:1rem;border-radius:8px;display:none;font-weight:500}
.status-msg.success{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;display:block}
.status-msg.error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;display:block}
.footer{text-align:center;padding:2rem;color:#94a3b8;font-size:.9rem}
.updated{text-align:center;color:#94a3b8;font-size:.85rem;margin-bottom:1.5rem}
</style>
</head>
<body>
<div class="header"><h1>Watson AI</h1><p>Politica de Privacidade</p></div>
<div class="container">
<p class="updated">Ultima atualizacao: 04 de marco de 2026</p>
<div class="section"><h2>1. Introducao</h2><p>O Watson AI ("nos", "nosso" ou "aplicativo") e um assistente inteligente para WhatsApp com CRM integrado. Esta politica descreve como coletamos, usamos e protegemos seus dados pessoais em conformidade com a Lei Geral de Protecao de Dados (LGPD - Lei 13.709/2018).</p></div>
<div class="section"><h2>2. Dados que Coletamos</h2><p>Ao utilizar o Watson AI, podemos coletar:</p><ul><li><strong>Dados de cadastro:</strong> nome, email, telefone e senha (criptografada)</li><li><strong>Dados de conversas:</strong> mensagens trocadas via WhatsApp processadas pelo assistente de IA</li><li><strong>Dados de contatos (CRM):</strong> informacoes de contatos adicionados ao CRM</li><li><strong>Dados de uso:</strong> logs de acesso, interacoes com o aplicativo e preferencias</li><li><strong>Dados do dispositivo:</strong> modelo do aparelho, sistema operacional e identificadores unicos</li></ul></div>
<div class="section"><h2>3. Como Usamos seus Dados</h2><ul><li>Fornecer e manter o servico de assistente de IA para WhatsApp</li><li>Gerenciar o CRM e contatos vinculados a sua conta</li><li>Melhorar a qualidade das respostas automaticas da IA</li><li>Enviar notificacoes relevantes sobre suas conversas</li><li>Garantir a seguranca e prevenir fraudes</li></ul></div>
<div class="section"><h2>4. Compartilhamento de Dados</h2><p>Seus dados podem ser compartilhados com:</p><ul><li><strong>Provedores de IA:</strong> para processamento de mensagens (dados anonimizados quando possivel)</li><li><strong>Servicos de infraestrutura:</strong> para hospedagem e armazenamento seguro</li><li><strong>Integracao WhatsApp:</strong> para envio e recebimento de mensagens via API oficial</li></ul><p>Nao vendemos seus dados pessoais a terceiros.</p></div>
<div class="section"><h2>5. Armazenamento e Seguranca</h2><p>Seus dados sao armazenados em servidores seguros com criptografia em transito (HTTPS/TLS) e em repouso. Senhas sao armazenadas utilizando hash criptografico (bcrypt). Implementamos medidas tecnicas e organizacionais para proteger seus dados contra acesso nao autorizado.</p></div>
<div class="section"><h2>6. Seus Direitos (LGPD)</h2><p>De acordo com a LGPD, voce tem direito a:</p><ul><li>Confirmar a existencia de tratamento de seus dados</li><li>Acessar seus dados pessoais</li><li>Corrigir dados incompletos ou desatualizados</li><li>Solicitar a anonimizacao ou bloqueio de dados desnecessarios</li><li><strong>Solicitar a exclusao total de seus dados pessoais</strong></li><li>Revogar o consentimento a qualquer momento</li></ul></div>
<div class="section delete-section" id="delete-section"><h2>7. Exclusao de Dados</h2><p>Voce pode solicitar a exclusao completa de todos os seus dados vinculados a sua conta. Isso inclui: dados de perfil, conversas, contatos do CRM e todo historico de uso.</p><p><strong>Atencao:</strong> esta acao e irreversivel. Apos a exclusao, nao sera possivel recuperar seus dados.</p>
<form id="deleteForm" style="margin-top:1.5rem"><div class="form-group"><label for="email">Email da conta</label><input type="email" id="email" placeholder="seu@email.com" required></div><div class="form-group"><label for="password">Senha</label><input type="password" id="password" placeholder="Sua senha" required></div><div class="form-group"><label for="confirm">Digite "EXCLUIR MEUS DADOS" para confirmar</label><input type="text" id="confirm" placeholder="EXCLUIR MEUS DADOS" required></div><button type="submit" class="btn-delete" id="deleteBtn">Solicitar Exclusao dos Meus Dados</button><div class="status-msg" id="statusMsg"></div></form></div>
<div class="section"><h2>8. Contato</h2><p>Para duvidas, solicitacoes ou exercer seus direitos, entre em contato:</p><ul><li><strong>Email:</strong> contato@watson-ai.com</li></ul></div>
<div class="section"><h2>9. Alteracoes nesta Politica</h2><p>Podemos atualizar esta politica periodicamente. Notificaremos sobre mudancas significativas atraves do aplicativo ou por email.</p></div>
</div>
<div class="footer"><p>&copy; 2026 Watson AI. Todos os direitos reservados.</p></div>
<script>
var API_URL=window.location.origin+'/api/v1';
document.getElementById('deleteForm').addEventListener('submit',async function(e){
e.preventDefault();
var email=document.getElementById('email').value.trim();
var password=document.getElementById('password').value;
var confirmVal=document.getElementById('confirm').value.trim();
var btn=document.getElementById('deleteBtn');
var statusMsg=document.getElementById('statusMsg');
statusMsg.className='status-msg';statusMsg.style.display='none';
if(confirmVal!=='EXCLUIR MEUS DADOS'){statusMsg.className='status-msg error';statusMsg.textContent='Por favor, digite "EXCLUIR MEUS DADOS" exatamente como indicado.';return;}
btn.disabled=true;btn.textContent='Processando...';
try{
var loginRes=await fetch(API_URL+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:password})});
if(!loginRes.ok)throw new Error('Email ou senha incorretos.');
var loginData=await loginRes.json();
var token=loginData.data?loginData.data.accessToken:loginData.accessToken;
if(!token)throw new Error('Erro na autenticacao. Tente novamente.');
var deleteRes=await fetch(API_URL+'/auth/delete-account',{method:'DELETE',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}});
if(!deleteRes.ok){var errData=await deleteRes.json().catch(function(){return null});throw new Error(errData&&errData.message?errData.message:'Erro ao processar exclusao.');}
statusMsg.className='status-msg success';statusMsg.textContent='Seus dados foram excluidos com sucesso. Sua conta foi removida permanentemente.';
document.getElementById('deleteForm').reset();
}catch(err){statusMsg.className='status-msg error';statusMsg.textContent=err.message;}
finally{btn.disabled=false;btn.textContent='Solicitar Exclusao dos Meus Dados';}
});
</script>
</body></html>`;


async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "watson-ai-secret-key-change-me",
    sign: { expiresIn: "15m" },
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await fastify.register(sensible);

  // Allow empty JSON bodies (mobile sends POST with Content-Type: application/json but no body)
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser("application/json", { parseAs: "string" }, function (_req, body, done) {
    if (!body || body === "") {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });
  await fastify.register(websocket);
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  });

  // Register authenticate decorator
  await fastify.register(authenticatePlugin);

  // Socket.IO setup
  const io = new Server(fastify.server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
      credentials: true,
    },
  });

  // Decorate fastify with io
  fastify.decorate("io", io);

  // Socket.IO authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = fastify.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  // Socket.IO events
  io.on("connection", (socket) => {
    const user = socket.data.user;
    fastify.log.info(`Socket connected: ${user.userId} from org ${user.orgId}`);

    // Join organization room
    socket.join(`org:${user.orgId}`);

    socket.on("disconnect", () => {
      fastify.log.info(`Socket disconnected: ${user.userId}`);
    });
  });

  // Health check
  fastify.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
    };
  });

  // Privacy Policy page (public, no auth)
  fastify.get("/privacy", async (_request, reply) => {
    reply.type("text/html").send(privacyPageHtml);
  });

  // Email test - verifica conexao SMTP
  fastify.get("/api/v1/test-email", async () => {
    const result = await testEmailConnection();
    return result;
  });

  // Email test - envia email de teste
  fastify.get<{ Querystring: { to: string } }>("/api/v1/test-email/send", async (request, reply) => {
    const { to } = request.query;
    if (!to) {
      return reply.badRequest("Parametro 'to' obrigatorio. Ex: /api/v1/test-email/send?to=seu@email.com");
    }
    const connectionTest = await testEmailConnection();
    if (!connectionTest.success) {
      return { success: false, step: "connection", error: connectionTest.message, details: connectionTest.details };
    }
    const sent = await sendTestEmail(to);
    return { success: sent, step: "send", to, message: sent ? "Email enviado! Verifique sua caixa." : "Falha ao enviar. Veja os logs." };
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  await fastify.register(conversationRoutes, { prefix: "/api/v1/conversations" });
  await fastify.register(contactRoutes, { prefix: "/api/v1/contacts" });
  await fastify.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
  await fastify.register(personaRoutes, { prefix: "/api/v1/personas" });
  await fastify.register(knowledgeRoutes, { prefix: "/api/v1/knowledge" });
  await fastify.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  await fastify.register(whatsappRoutes, { prefix: "/api/v1/whatsapp" });
  await fastify.register(automationRoutes, { prefix: "/api/v1/automations" });
  await fastify.register(triggerRoutes, { prefix: "/api/v1/triggers" });
  await fastify.register(crmRoutes, { prefix: "/api/v1/crm" });
  return fastify;
}

// Start server
async function start() {
  try {
    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });

    server.log.info(`Watson API running on http://${HOST}:${PORT}`);
    server.log.info(`Environment: ${process.env.NODE_ENV || "development"}`);

    // Start automation scheduler
    startAutomationScheduler(server.log);

    // Start remarketing scheduler + wire Socket.IO events
    setRemarketingEventCallback((orgId, conversationId, message) => {
      server.io.to(`org:${orgId}`).emit("message:new", { conversationId, message });
    });
    startRemarketingScheduler(server.log);

    // Graceful shutdown
    const shutdown = async () => {
      server.log.info("Shutting down server...");
      stopAutomationScheduler(server.log);
      stopRemarketingScheduler(server.log);
      await server.close();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
