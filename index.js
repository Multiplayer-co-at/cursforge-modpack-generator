import { Curseforge } from "node-curseforge";
import { extract, archiveFolder } from "zip-lib";
import { tmpdir } from "node:os";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import {
  existsSync,
  statSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  copyFileSync,
  createWriteStream,
} from "node:fs";
import { dirname, basename, join } from "node:path";
import fetch from "node-fetch";

let workspace = process.env.GITHUB_WORKSPACE || tmpdir();
workspace = join(workspace, uuidv4());
const curseforge = new Curseforge(process.env.INPUT_TOKEN);

async function copyFolder(source, destination) {
  try {
    console.log(`Copying ${source} to ${destination}`);
    await mkdirSync(destination, { recursive: true });
    const items = readdirSync(source);
    const promises = items.map((item) => {
      const sourcePath = join(source, item);
      const destinationPath = sourcePath.replace(source, destination);
      if (statSync(sourcePath).isDirectory()) {
        mkdirSync(destinationPath, { recursive: true });
        return copyFolder(sourcePath, destinationPath);
      } else {
        mkdirSync(dirname(destinationPath), { recursive: true });
        return copyFileSync(sourcePath, destinationPath);
      }
    });
    await Promise.all(promises);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

async function installModLoader(manifestPath, destinationPath) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath));
    const modloader = manifest.minecraft.modLoaders[0].id;
    const modloaderInfo = await curseforge.get_minecraft_modloader(modloader);
    console.log(`Downloading ${modloaderInfo.name}`);
    const response = await fetch(modloaderInfo.downloadUrl);
    const file = createWriteStream(
      join(destinationPath, modloaderInfo.filename)
    );
    await new Promise((resolve, reject) => {
      response.body.pipe(file);
      response.body.on("error", (error) => {
        reject(error);
      });
      file.on("finish", () => {
        file.close();
        resolve();
      });
    });
    await new Promise((resolve, reject) => {
      const execProcess = exec(
        `java -jar ${modloaderInfo.filename} --installServer`,
        {
          cwd: destinationPath,
        }
      );
      execProcess.stdout.on("data", (data) => {
        console.log(data.toString());
      });
      execProcess.stderr.on("data", (data) => {
        console.log(data.toString());
      });
      execProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

async function generate(clientPackPath) {
  try {
    console.log("Generating...");
    await copyFileSync(
      clientPackPath,
      join(workspace, basename(clientPackPath))
    );
    await extract(
      join(workspace, basename(clientPackPath)),
      join(workspace, "client")
    );
    await copyFolder(
      join(workspace, "client", "overrides"),
      join(workspace, "server")
    );
    // await copyFolder(join(__dirname, assets), join(workspace, "server"));
    await downloadMods(
      join(workspace, "client", "manifest.json"),
      join(workspace, "server", "mods")
    );
    await installModLoader(
      join(workspace, "client", "manifest.json"),
      join(workspace, "server")
    );
    await archiveFolder(
      join(workspace, "server"),
      join(dirname(clientPackPath), `${basename(clientPackPath).split(".")[0]}-server.zip`)
    );
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

async function downloadMods(manifestPath, destinationPath) {
  try {
    console.log("Downloading mods...");
    const manifest = JSON.parse(readFileSync(manifestPath));
    const mods = manifest.files;
    await mkdirSync(destinationPath, { recursive: true });
    const promises = mods.map((mod) => downloadMod(mod, destinationPath));
    return Promise.all(promises);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

async function downloadMod(mod, destinationPath) {
  try {
    const { projectID, fileID } = mod;
    const modFileInfo = await curseforge.get_file(projectID, fileID);
    console.log(`Downloading ${modFileInfo.displayName}`);
    const response = await fetch(modFileInfo.downloadUrl);
    const file = createWriteStream(join(destinationPath, modFileInfo.fileName));
    return new Promise((resolve, reject) => {
      response.body.pipe(file);
      response.body.on("error", (err) => reject(err));
      file.on("finish", () => {
        file.close();
        resolve();
      });
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

(async function () {
  console.log({
    workspace: workspace,
    clientPackPath: process.env.INPUT_CLIENTPACK,
  })
  if (!existsSync(workspace)) {
    mkdirSync(workspace, { recursive: true });
  }
  await generate(
    process.env.INPUT_CLIENTPACK
  );
})();
