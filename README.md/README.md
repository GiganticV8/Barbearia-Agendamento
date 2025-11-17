💈 Sistema de Agendamento para Barbearia

Este é um aplicativo web React para agendamento de serviços em uma barbearia, utilizando Firebase Firestore para persistência de dados em tempo real e Tailwind CSS para estilização.

🚀 Setup do Projeto (Ambiente Local)

Siga estas instruções para configurar o projeto na sua máquina:

Crie a Estrutura de Pastas:
Crie uma pasta raiz para o projeto (ex: barbearia-agendamento). Dentro dela, você deve ter a seguinte organização:

/barbearia-agendamento
├── node_modules/ (Criado após 'npm install')
├── public/
│   └── index.html
├── src/
│   ├── App.jsx           <- Componente principal da aplicação
│   ├── main.jsx          <- Ponto de entrada do React
│   └── index.css         <- Estilos globais/Tailwind
├── package.json          <- Dependências e scripts
├── tailwind.config.js    <- Configuração do Tailwind
└── README.md             <- Este guia


Insira os Arquivos:
Copie o conteúdo dos arquivos gerados (App.jsx, main.jsx, index.css, package.json, tailwind.config.js) para os seus respectivos locais.

Instale as Dependências:
Abra o terminal na pasta raiz (/barbearia-agendamento) e execute:

npm install


Configuração do Firebase (CRÍTICO):
Para conectar ao seu próprio banco de dados Firestore, você deve configurar suas chaves.

Crie um arquivo chamado .env.local na raiz do projeto e adicione suas chaves do Firebase:

# Exemplo de configuração do Firebase (Substitua pelos seus dados reais)
VITE_FIREBASE_API_KEY="AIzaSy...seu-api-key"
VITE_FIREBASE_AUTH_DOMAIN="seusite.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="seu-project-id"
VITE_FIREBASE_STORAGE_BUCKET="seu-bucket.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef1234567890"

# Nota: No ambiente de deploy real, você pode precisar definir VITE_APP_ID 
# e VITE_FIREBASE_CONFIG_JSON ou adaptar o código do App.jsx para ler
# diretamente as chaves VITE_FIREBASE_...


Rode Localmente:
Execute o script de desenvolvimento:

npm run dev


🌐 Subindo para o GitHub

Inicialize o Git e Commit:
Na pasta raiz do projeto:

git init
git add .
git commit -m "feat: setup inicial do sistema de agendamento"


Crie o Repositório no GitHub:
Vá para o GitHub, crie um novo repositório vazio.

Conecte e Envie:
Conecte seu repositório local ao GitHub e envie os arquivos (substitua SEU_LINK_REMOTO_DO_GITHUB):

git remote add origin SEU_LINK_REMOTO_DO_GITHUB
git push -u origin main


Deploy em Plataformas (Vercel/Netlify):
Após subir para o GitHub, você pode facilmente fazer o deploy, lembrando-se de configurar as variáveis de ambiente do Firebase na plataforma de hospedagem.

Este README.md foi gerado automaticamente e assume o uso de Vite para desenvolvimento React.