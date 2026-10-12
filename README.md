# To-Do dApp — Blockchain Task Manager

A decentralized To-Do application built with **Solidity, Hardhat, Next.js, TypeScript, and ethers.js**. It connects to MetaMask and uses a smart contract to manage tasks on the Ethereum-compatible blockchain.

## Features

- **MetaMask Integration** — Connect your crypto wallet to the application.
- **Create Tasks** — Add tasks that are stored through smart contract transactions.
- **Update Tasks** — Edit existing task content.
- **Complete Tasks** — Mark tasks as completed or reopen them.
- **Delete Tasks** — Soft-delete tasks without removing their original on-chain records.
- **Wallet-Specific Tasks** — Each wallet can manage its own tasks.
- **Transaction History** — View task-related blockchain activity.
- **Responsive UI** — Use a clean interface with separate task and transaction history views.
- **Smart Contract Validation** — Reject empty or whitespace-only tasks and enforce a 200-byte content limit.

## Tech Stack

| Technology | Purpose |
|---|---|
| Solidity | Smart contract development |
| Hardhat 3 | Smart contract development and testing |
| Next.js | Frontend application |
| React | User interface |
| TypeScript | Type-safe development |
| ethers.js v6 | Blockchain interaction |
| MetaMask | Wallet connection |
| Tailwind CSS | Responsive styling |

## Project Structure

```text
todo-dapp/
├── contracts/             # Solidity smart contracts
├── test/                  # Smart contract tests
├── scripts/               # Deployment and utility scripts
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js application pages
│   │   ├── lib/           # Contract interaction utilities
│   │   └── contracts/     # Contract ABI and configuration
│   ├── package.json
│   └── tsconfig.json
├── hardhat.config.ts
├── package.json
└── README.md
```

*The exact structure may vary depending on your local project files.*

## Prerequisites

Install the following before running the project:

- Node.js and npm
- Git
- MetaMask browser extension
- A web browser
- A code editor such as Visual Studio Code

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/ShahnoorElahi/todo-dapp.git
cd todo-dapp
```

### 2. Install Root Dependencies

```bash
npm install
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Start the Local Blockchain

Open a terminal in the project root:

```bash
npx hardhat node
```

Keep this terminal running. The local blockchain provides development accounts and a JSON-RPC endpoint.

### 5. Deploy the Smart Contract

In a separate terminal, from the project root, run the deployment script provided by your project. For example:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

If your deployment script or network configuration uses a different command, use the one configured in your project.

**Important:** After deployment, configure the frontend with the deployed contract address and matching ABI. A restarted local Hardhat node creates a fresh local chain, so the contract may need to be redeployed.

### 6. Configure MetaMask

Add a local development network in MetaMask using these settings:

| Setting | Value |
|---|---|
| Network name | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | ETH |

For local development only, import an account using a private key printed by your local Hardhat node. **Never use a development private key with real funds or publish it to GitHub.**

### 7. Start the Frontend

```bash
cd frontend
npm run dev
```

Open the application at:

http://localhost:3000

Connect MetaMask to the local network and begin managing tasks.

## Smart Contract Design

The `Todo` contract provides wallet-scoped task management.

Each task stores:

- `id` — Task identifier
- `content` — Task description
- `completed` — Completion status
- `createdAt` — Creation timestamp
- `deleted` — Soft-deletion status

The contract also emits events for task creation, updates, completion, and deletion.

### Access Control

Tasks are associated with the wallet address that creates them. Contract functions use `msg.sender` to access and modify that wallet's tasks. The contract does not use a privileged administrator or owner role.

### Task Validation

- Empty content is rejected.
- Whitespace-only content is rejected.
- Task content is limited to 200 bytes.
- Deleted tasks cannot be updated, completed, or deleted again through the normal task operations.

## Running Tests

From the project root:

```bash
npx hardhat test
```

The tests verify the smart contract's behavior. Run them locally before making changes or publishing updates.

## Development Workflow

After making changes:

```bash
git add .
git commit -m "Describe your changes"
git push
```

## Security Notes

- Never commit private keys, seed phrases, wallet passwords, or `.env` secrets.
- Use only local development accounts for this project.
- Review smart contract changes and test them before deploying to any network with real assets.
- Blockchain transactions may require gas and generally cannot be reversed once confirmed.

## Future Improvements

- Task search, filtering, and sorting
- Pagination for large task lists
- More extensive frontend and contract tests
- Improved transaction status and error handling
- Optional off-chain indexing for faster transaction history queries

## Author

**Shahnoor Elahi**

GitHub: [@ShahnoorElahi](https://github.com/ShahnoorElahi)

## License

No license has been specified yet. 