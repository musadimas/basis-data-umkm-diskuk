/* eslint-disable @typescript-eslint/ban-ts-comment */
import { SchemaOverview } from "@directus/types";
import { oas, oasConfig } from "./types";

import yaml from "js-yaml";
import path from "path";
import fs from "fs";

const directusDir = () => process.cwd();
const extensionDir = process.env.EXTENSIONS_PATH || "./extensions";

let oasBuffer: string;

export const EXCLUDED_TAG_RE = /^Items(\{\{.*?\}\}|[A-Z].*)?$/;

function isBoolean(value: boolean | undefined): value is boolean {
  return typeof value === "boolean";
}

/**
 * Retrieves the configuration for OpenAPI specification (OAS) generation.
 * The function attempts to load the configuration from a YAML file located in the specified extension directory.
 * If the file is not found, it falls back to a legacy location.
 * If the configuration file is not valid or cannot be read, it returns a default configuration.
 *
 * @returns {oasConfig} The OAS configuration.
 */
function getConfigRoot(): oasConfig {
  const defConfig: oasConfig = {
    docsPath: "v1/docs",
    info: {},
    tags: [],
    publishedTags: [],
    excludePrefixes: [],
    useAuthentication: false,
    paths: {},
    components: {},
  };
  try {
    let config;
    try {
      // packaged extensions
      const configFile = path.join(directusDir(), extensionDir, "/oasconfig.yaml");
      // SAFETY: oasconfig.yaml is a repo-controlled file maintained against the oasConfig schema.
      config = yaml.load(fs.readFileSync(configFile, { encoding: "utf-8" })) as oasConfig;
    } catch {
      // legacy
      const configFile = path.join(directusDir(), extensionDir, "/endpoints/oasconfig.yaml");
      // SAFETY: oasconfig.yaml is a repo-controlled file maintained against the oasConfig schema.
      config = yaml.load(fs.readFileSync(configFile, { encoding: "utf-8" })) as oasConfig;
    }
    config.docsPath = config.docsPath || defConfig.docsPath;
    config.info = config.info || defConfig.info;
    config.tags = config.tags || defConfig.tags;
    config.publishedTags = config.publishedTags || defConfig.publishedTags;
    config.excludePrefixes = config.excludePrefixes || defConfig.excludePrefixes;
    config.useAuthentication = isBoolean(config.useAuthentication) ? config.useAuthentication : defConfig.useAuthentication;
    config.paths = config.paths || defConfig.paths;
    config.components = config.components || defConfig.components;
    return config;
  } catch {
    return defConfig;
  }
}

/**
 * Filters the paths and tags in the OpenAPI specification (OAS) based on the published tags
 * specified in the configuration. It removes any paths and tags that are not marked as published.
 *
 * @param config - The configuration object containing the published tags.
 * @param oas - The OpenAPI specification object to be filtered.
 */
export function filterPaths(config: oasConfig, oas: oas) {
  for (const path in oas.paths) {
    for (const method in oas.paths[path]) {
      let published = false;

      // @ts-ignore
      const tags = oas.paths[path][method].tags || [];

      tags.forEach((tag) => {
        published = published || config.publishedTags.includes(tag);
      });

      // @ts-ignore
      oas.paths[path][method].tags = tags.filter((tag) => config.publishedTags.includes(tag) && !EXCLUDED_TAG_RE.test(tag));

      // @ts-ignore
      if (!published) delete oas.paths[path][method];
    }
  }
  oas.tags = oas.tags.filter((tag) => config.publishedTags.includes(tag.name) && !EXCLUDED_TAG_RE.test(tag.name));
}

export function getConfig(): oasConfig {
  const config = getConfigRoot();
  try {
    const mergeConfig = (oasPath: string) => {
      // SAFETY: each oas.yaml is a repo-controlled OpenAPI document matching the oas schema.
      const doc = yaml.load(fs.readFileSync(oasPath, { encoding: "utf-8" })) as oas;
      config.tags = [...config.tags, ...(doc.tags || [])];
      config.paths = { ...config.paths, ...doc.paths };
      config.components = merge(config.components || {}, doc.components || {});
    };

    const scanDirectory = (dirPath: string) => {
      if (!fs.existsSync(dirPath)) return;

      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const file of files) {
        if (!file.isDirectory()) continue;

        const extensionPath = path.join(dirPath, file.name);

        // Check for oas.yaml at root
        const rootOasPath = path.join(extensionPath, "oas.yaml");
        if (fs.existsSync(rootOasPath)) {
          mergeConfig(rootOasPath);
        }

        // Check for oas.yaml in src subdirectories
        const srcPath = path.join(extensionPath, "src");
        if (fs.existsSync(srcPath)) {
          const srcOasPath = path.join(srcPath, "oas.yaml");
          if (fs.existsSync(srcOasPath)) {
            mergeConfig(srcOasPath);
          }

          const srcFiles = fs.readdirSync(srcPath, { withFileTypes: true });
          for (const srcFile of srcFiles) {
            if (srcFile.isDirectory()) {
              const bundleOasPath = path.join(srcPath, srcFile.name, "oas.yaml");
              if (fs.existsSync(bundleOasPath)) {
                mergeConfig(bundleOasPath);
              }
            }
          }
        }
      }
    };

    const extensionsPath = path.join(directusDir(), extensionDir);
    scanDirectory(extensionsPath);

    // Legacy support for /endpoints subfolder
    const legacyEndpointsPath = path.join(directusDir(), extensionDir, "/endpoints");
    scanDirectory(legacyEndpointsPath);

    return config;
  } catch {
    return config;
  }
}

export async function getOasAll(services: any, schema: SchemaOverview): Promise<oas> {
  if (oasBuffer) return JSON.parse(oasBuffer);

  const { SpecificationService } = services;
  const service = new SpecificationService({
    accountability: { admin: true },
    schema,
  });

  oasBuffer = JSON.stringify(await service.oas.generate());

  return JSON.parse(oasBuffer);
}

export async function getOas(services: any, schema: SchemaOverview, accountability: any): Promise<oas> {
  const { SpecificationService } = services;
  const service = new SpecificationService({
    accountability,
    schema,
  });

  const oas = JSON.stringify(await service.oas.generate());

  return JSON.parse(oas);
}

export async function getPackage() {
  try {
    return require(`${directusDir()}/package.json`);
  } catch {
    return {};
  }
}

type MergeValue = string | number | boolean | null | MergeValue[] | MergeObject;

interface MergeObject {
  [key: string]: MergeValue;
}

function isMergeableSource(value: MergeValue): value is MergeObject | MergeValue[] {
  return value !== null && typeof value === "object";
}

export function merge(a: any, b: any) {
  return Object.entries(b).reduce((o, [k, v]: [string, any]) => {
    o[k] = isMergeableSource(v) ? merge((o[k] = o[k] || (Array.isArray(v) ? [] : {})), v) : v;
    return o;
  }, a);
}
