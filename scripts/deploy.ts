import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const todo = await ethers.deployContract("Todo");
  await todo.waitForDeployment();
  console.log("Todo contract deployed!");
  console.log("Contract address:", await todo.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
