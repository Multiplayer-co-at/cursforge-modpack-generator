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

const ignoredMods = process.env.INPUT_IGNORED_MODS || [];
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
    console.log(`Downloading and Installing ${modloaderInfo.name}`);
    const response = await fetch(modloaderInfo.downloadUrl);
    const file = createWriteStream(
      join(destinationPath, `forge-${modloaderInfo.minecraftVersion}-${modloaderInfo.forgeVersion}-installer.jar`)
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
      join(dirname(clientPackPath), "serverpack.zip")
    );
    console.log("Saving archive to: " + join(dirname(clientPackPath), "serverpack.zip"));
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

async function downloadMod(mod, destinationPath, retry = 0) {
  const { projectID, fileID, __meta } = mod;
  try {
    if (ignoredMods.includes(projectID)) {
      console.log(`Ignoring mod ${__meta.name}`);
      return;
    }
    const modFileInfo = await curseforge.get_file(projectID, fileID);
    const response = await fetch(modFileInfo.downloadUrl);
    const file = createWriteStream(join(destinationPath, modFileInfo.fileName));
    return new Promise(function downloadPromise(resolve, reject) {
      console.log(`Downloading ${__meta.name}`);
      response.body.pipe(file);
      response.body.on("error", (err) => reject(err));
      file.on("finish", () => {
        file.close();
        console.log(`Downloaded ${__meta.name}`);
        resolve();
      });
    });
  } catch (error) {
    if (retry < 3) {
      console.log(`Retrying download of ${__meta.name} (${retry + 1}/${3})`);
      return downloadMod(mod, destinationPath, retry + 1);
    } else {
      console.log(`Failed to download ${__meta.name}\n ${error}`);
      process.exit(1);
    }
  }
}

(async function () {
  if (!existsSync(workspace)) {
    mkdirSync(workspace, { recursive: true });
  }
  await generate(
    process.env.INPUT_CLIENTPACK
  );
})();
