/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { resolve } from "path";
import { Command } from "commander";
import fs from "fs-extra";
import Docker from "dockerode";
import {
  TechdocsGenerator,
  ParsedLocationAnnotation
} from "@backstage/techdocs-common";
import { ConfigReader } from "@backstage/config";
import {
  convertTechDocsRefToLocationAnnotation,
  createLogger
} from "../../lib/utility";

export default async function generate(cmd: Command) {
  // Use techdocs-common package to generate docs. Keep consistency between Backstage and CI generating docs.
  // Docs can be prepared using actions/checkout or git clone, or similar paradigms on CI. The TechDocs CI workflow
  // will run on the CI pipeline containing the documentation files.
  //
  // Create a generator from config
  // Generator.run (source directory, docker client, parsed annotation, output dir)
  // Will create output dir parents on its own

  const logger = createLogger({ verbose: cmd.verbose });

  const sourceDir = resolve(cmd.sourceDir);
  const outputDir = resolve(cmd.outputDir);
  logger.info(`Using source dir ${sourceDir}`);
  logger.info(`Will output generated files in ${outputDir}`);

  logger.verbose("Creating output directory if it does not exist.");

  await fs.ensureDir(outputDir);

  const config = new ConfigReader({
    techdocs: {
      generators: {
        techdocs: cmd.docker ? "docker" : "local"
      }
    }
  });

  // Docker client (conditionally) used by the generators, based on techdocs.generators config.
  const dockerClient = new Docker();

  let parsedLocationAnnotation = {} as ParsedLocationAnnotation;
  if (cmd.techdocsRef) {
    try {
      parsedLocationAnnotation = convertTechDocsRefToLocationAnnotation(
        cmd.techdocsRef
      );
    } catch (err) {
      logger.error(err.message);
    }
  }

  // Generate docs using @backstage/techdocs-common
  const techdocsGenerator = new TechdocsGenerator(logger, config);
  logger.info("Generating documentation...");
  await techdocsGenerator.run({
    directory: sourceDir,
    dockerClient: dockerClient,
    expectedResultDir: outputDir,
    ...(cmd.techdocsRef && {
      parsedLocationAnnotation
    })
  });

  logger.info("Done!");
}
