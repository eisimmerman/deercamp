import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function requireExactConfirmation(expectedValue) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "Interactive confirmation requires a terminal. No action taken."
    );
  }

  const interfaceInstance = readline.createInterface({ input, output });

  try {
    console.log("");
    console.log("Type exactly:");
    console.log("");
    console.log(expectedValue);
    console.log("");
    const answer = await interfaceInstance.question("to continue: ");

    if (answer !== expectedValue) {
      throw new Error("Confirmation did not match. No action taken.");
    }
  } finally {
    interfaceInstance.close();
  }
}
