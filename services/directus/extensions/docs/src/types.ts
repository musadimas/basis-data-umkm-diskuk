export interface oasInfo {
  title?: string;
  version?: string;
  description?: string;
  "x-logo"?: {
    url: string;
    altText?: string;
  };
}

export interface oasTag {
  name: string;
  description?: string;
}

export interface oasOperation {
  tags?: string[];
}

export interface oasPathItem {
  [method: string]: oasOperation;
}

export interface oasSecurityScheme {
  type: string;
  in?: string;
  name?: string;
}

export interface oasComponents {
  securitySchemes?: { [scheme: string]: oasSecurityScheme };
}

export interface oasConfig {
  docsPath: string;
  info: oasInfo;
  tags: Array<oasTag>;
  publishedTags: Array<string>;
  excludePrefixes: Array<string>;
  useAuthentication: boolean;
  paths: {
    [path: string]: oasPathItem;
  };
  components: oasComponents;
}

export interface oas {
  info: oasInfo;
  tags: Array<oasTag>;
  paths: {
    [path: string]: oasPathItem;
  };
  components: oasComponents;
}
