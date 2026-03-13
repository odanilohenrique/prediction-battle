# 🤝 Prediction Battle - Transfer Guide & Sales Strategy

## 📍 Where to Sell the Project

To get the best price for this DApp, you should target platforms and communities where web3 developers, investors, and SocialFi enthusiasts hang out:

### 1. Web3 Marketplaces & Forums
- **Acquire.com:** The best platform for selling profitable or complete SaaS/DApp businesses. You can list the product, tech stack, and ask for a specific price.
- **Flippa:** While traditionally for Web2, they have a growing Web3 app section.
- **Ethresear.ch / Web3 Forums:** Niche forums where builders look for base layers to build upon.

### 2. Crypto Twitter (X) & Farcaster
- **Farcaster (Warpcast):** Since the app is built for Farcaster, the best buyers are already on the platform. Post the pitch in channels like `/dev`, `/frontend`, or `/base`. 
- **Twitter (X):** Thread about how you built a Polymarket competitor for SocialFi and state that the IP/Codebase is for sale. Tag builders in the Base ecosystem.

### 3. Direct Outreach
- **SocialFi Projects:** Reach out to projects on Base (like Degen, Drakula, or similar) who might want to acquire a betting module to integrate into their existing platforms.
- **Web3 Venture Studios:** Studios are always looking for fully-built MVPs they can launch with their marketing power.

---

## 📦 How to Transfer the Project to the Buyer

When you secure a buyer, follow this checklist to safely hand over the project:

### 1. Codebase Transfer
- Transfer ownership of the GitHub repository `odanilohenrique/prediction-battle`.
- Go to GitHub -> Settings -> General -> Danger Zone -> Transfer Ownership.

### 2. Smart Contract Transfer (Crucial)
The smart contract currently recognizes your wallet as the `ADMIN`. You must transfer this to the buyer so they can collect fees and resolve markets.
- Use Basescan to call the `transferOwnership(address newOwner)` function on the V10 contract.
- Input the buyer's wallet address.
- **Warning:** Once you do this, you lose all admin rights. Do this only AFTER payment is secured.

### 3. Vercel & Infrastructure
- Add the buyer's email to your Vercel team/project and make them an Owner, or use Vercel's project transfer feature.
- Ensure they understand they need to input their own `NEXT_PUBLIC_ONCHAINKIT_API_KEY` in the Vercel environment variables.

### 4. Treasury & Operator Wallets
- Instruct the buyer to update the `.env.local` (and Vercel ENV) variables:
  - `RECEIVER_ADDRESS`: Their treasury wallet where the 10% house fee will go.
  - `OPERATOR_PRIVATE_KEY`: A new hot-wallet private key they control for the backend to resolve matches automatically.

### 5. Social Accounts & Domains
- Transfer the Vercel domain or custom domain via your DNS provider.
- Hand over any related Twitter, Farcaster, or Discord credentials associated with the brand.
