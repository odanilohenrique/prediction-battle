# 🧪 Guia de Setup - Testnet (Base Sepolia)

## 🎯 Objetivo
Configurar o Painel Admin e testar apostas com USDC fake (testnet) antes de usar dinheiro real.

---

## 📋 Passo a Passo

### 1. Configurar Carteira para Testnet

#### 1.1 Instalar MetaMask ou Coinbase Wallet
```bash
# MetaMask: https://metamask.io/
# Coinbase Wallet: https://wallet.coinbase.com/
```

#### 1.2 Adicionar Rede Base Sepolia

**No MetaMask:**
1. Click no seletor de rede (topo)
2. "Adicionar Rede" → "Adicionar rede manualmente"
3. Preencher:
   - **Nome da Rede**: Base Sepolia
   - **RPC URL**: `https://sepolia.base.org`
   - **Chain ID**: `84532`
   - **Símbolo**: ETH
   - **Block Explorer**: `https://sepolia.basescan.org`
4. Salvar

**Seu endereço:**
- Copiar endereço da carteira (começa com 0x...)
- Exemplo: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0`

### 2. Conseguir Testnet Tokens (GRÁTIS!)

#### 2.1 ETH Testnet (para gas fees)
```bash
# Faucet Base:
https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

# Passos:
1. Conectar carteira
2. Passar verificação captcha
3. Receber ~0.05 ETH testnet
```

#### 2.2 USDC Testnet (para apostas)
```bash
# Faucet Circle:
https://faucet.circle.com/

# Passos:
1. Escolher "Base Sepolia"
2. Colar seu endereço
3. Receber 10 USDC testnet
```

### 3. Configurar Projeto

#### 3.1 Criar .env.local
```bash
cd "c:\APPS\Prediction Batle"
copy .env.local.example .env.local
```

#### 3.2 Editar .env.local
```env
NEYNAR_API_KEY=D4D3EF36-7563-4321-AE04-CC5B2CEA5FC7

# IMPORTANTE: Cole SEU endereço aqui!
NEXT_PUBLIC_ADMIN_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0

# Testnet ativo
NEXT_PUBLIC_USE_MAINNET=false

NEXT_PUBLIC_URL=http://localhost:3000
```

### 4. Rodar Projeto Localmente

```bash
npm run dev
```

Abrir: http://localhost:3000

### 5. Acessar Painel Admin

```bash
# URL: http://localhost:3000/admin

# O que vai acontecer:
1. Tela pedindo para conectar wallet
2. Click "Conectar Wallet Admin"
3. Aprovar no MetaMask
4. ✅ Entrar no dashboard admin!
```

**Se der "Acesso Negado":**
- Verificar se endereço no `.env.local` está correto
- Verificar se é o mesmo endereço conectado na wallet
- Reiniciar `npm run dev`

### 6. Criar Primeira Aposta (Teste)

```bash
1. Click "Criar Nova Aposta"
2. Preencher:
   - Usuário: dwr
   - Métrica: Número de Posts
   - Alvo: 3
   - Período: 24h
   - Min: 0.05 USDC
   - Max: 10 USDC
3. Click "Criar Aposta"
4. ✅ Ver aposta no dashboard!
```

### 7. Testar Aposta como Usuário

```bash
1. Voltar para homepage: http://localhost:3000
2. Ver banner com aposta que você criou
3. Click "Apostar"
4. Escolher SIM/NÃO
5. Escolher valor (ex: 0.1 USDC)
6. Aprovar transação (testnet!)
```

**Nota:** Por enquanto, pagamentos ainda são simulados. Próxima etapa integra OnchainKit para transações reais.

---

## ✅ Checklist de Teste

- [ ] Carteira configurada com Base Sepolia
- [ ] ETH testnet recebido (para gas)
- [ ] USDC testnet recebido (para apostas)
- [ ] `.env.local` configurado com seu endereço
- [ ] Projeto rodando (`npm run dev`)
- [ ] Acesso ao painel admin funcionando
- [ ] Criação de aposta teste funcionando
- [ ] Aposta visível no dashboard

---

## 🐛 Troubleshooting

### "Acesso Negado" no Admin
```bash
# Solução:
1. Verificar endereço no .env.local
2. Copiar endereço exato da carteira
3. Adicionar ao NEXT_PUBLIC_ADMIN_ADDRESS
4. Reiniciar servidor (Ctrl+C e npm run dev)
```

### Testnet tokens não chegam
```bash
# Solução:
1. Aguardar 5-10 minutos
2. Verificar rede está Base Sepolia
3. Tentar outro faucet
4. Verificar no explorer: https://sepolia.basescan.org
```

### Wallet não conecta
```bash
# Solução:
1. Atualizar MetaMask/Coinbase Wallet
2. Limpar cache do navegador
3. Tentar modo incógnito
4. Verificar se Base Sepolia está adicionada
```

---

## 📊 Próximos Passos

Depois de testar tudo em testnet:

1. ✅ Criar conta Coinbase Developer
2. ✅ Conseguir API keys OnchainKit
3. ✅ Integrar pagamentos USDC reais
4. ✅ Testar em testnet com transações reais
5. ✅ Migrar para mainnet Base
6. ✅ Carregar USDC real
7. 🚀 **GO LIVE!**

---

## 💡 Dicas

- **Sempre teste em testnet primeiro**
- **Guarde sua seed phrase com segurança**
- **Testnet é grátis, abuse dos testes**
- **Só vá para mainnet quando tudo funcionar**

---

**Pronto para começar! 🚀**

Qualquer dúvida, me avise!
