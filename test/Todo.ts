
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("Todo", async function () {
  const { ethers } = await network.connect();

  it("should add and retrieve a task", async function () {
    const todo = await ethers.deployContract("Todo");
    await todo.waitForDeployment();

    await (await todo.addTask("Learn ethers.js")).wait();

    const tasks = await todo.getTasks();

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].content, "Learn ethers.js");
    assert.equal(tasks[0].completed, false);
  });

  it("should toggle a task's completion status", async function () {
    const todo = await ethers.deployContract("Todo");
    await todo.waitForDeployment();

    await (await todo.addTask("Build a dApp")).wait();
    await (await todo.toggleTask(0)).wait();

    const tasks = await todo.getTasks();

    assert.equal(tasks[0].completed, true);
  });

  it("should keep tasks separate for different wallets", async function () {
    const todo = await ethers.deployContract("Todo");
    await todo.waitForDeployment();

    const [owner, other] = await ethers.getSigners();

    await (await todo.addTask("Owner task")).wait();
    await (await todo.connect(other).addTask("Other wallet task")).wait();

    const ownerTasks = await todo.connect(owner).getTasks();
    const otherTasks = await todo.connect(other).getTasks();

    assert.equal(ownerTasks.length, 1);
    assert.equal(otherTasks.length, 1);
    assert.equal(ownerTasks[0].content, "Owner task");
    assert.equal(otherTasks[0].content, "Other wallet task");
  });
});
