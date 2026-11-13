#!/usr/bin/env node
/**
 * Read-only TypeScript AST inventory. A parser is required; never silently
 * downgrade AST evidence to regex results. Does not type-check or prove runtime.
 * Usage: node scripts/docs/typescript_ast_inventory.mjs path/to/file.ts [...]
 */
import {createRequire} from "node:module";
import {readFileSync,existsSync} from "node:fs";
import {resolve,relative,dirname,join,sep} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
function parser() {
  const possible=[
    process.env.SYNDES_TYPESCRIPT_PACKAGE_JSON,
    join(ROOT,"modules/core-crm/package.json"),
    join(ROOT,"apps/core-host/package.json"),
    join(ROOT,"apps/workspace-web/package.json"),
    join(ROOT,"packages/core-kernel/package.json"),
    join(ROOT,"package.json"),
  ];
  for(const path of possible) {
    if(!path||!existsSync(path))continue;
    try {return createRequire(path)("typescript");}catch{}
  }
  throw Error("TypeScript parser unavailable: install existing workspace devDependencies or provide SYNDES_TYPESCRIPT_PACKAGE_JSON; no regex fallback");
}
function safeFile(name) {
  const path=resolve(ROOT,name),rel=relative(ROOT,path);
  if(!rel || rel===".." || rel.startsWith(".."+sep) || ![".ts",".tsx"].some(ext=>path.endsWith(ext)))
    throw Error("Expected a TypeScript source path inside repository");
  if(!existsSync(path))throw Error("Source does not exist: "+rel);
  return {path,rel:rel.split(sep).join("/")};
}
export function extract(ts,files) {
  const records=[];
  const routeNames=new Set(["Controller","Get","Post","Put","Patch","Delete","Head","Options"]);
  const eventName=/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+\.v[1-9]\d*$/;
  const modifier=(node,kind)=>(node.modifiers||[]).some(m=>m.kind===kind);
  for (const item of files) {
    const {path,rel}=safeFile(item);
    const source=ts.createSourceFile(rel,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true,rel.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    const declarations=[],methods=[],decorators=[],events=[];
    const line=(node)=>source.getLineAndCharacterOfPosition(node.getStart(source)).line+1;
    function walk(node, owner=null) {
      const exported=modifier(node,ts.SyntaxKind.ExportKeyword) || (ts.isVariableDeclaration(node) && node.parent?.parent && modifier(node.parent.parent,ts.SyntaxKind.ExportKeyword));
      const name=node.name?.text;
      const isDecl=ts.isClassDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)||
        ts.isEnumDeclaration(node)||ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node);
      if(isDecl&&name && (!ts.isVariableDeclaration(node) || node.parent?.parent?.parent===source || (node.parent?.parent && modifier(node.parent.parent,ts.SyntaxKind.ExportKeyword)))){
        declarations.push({name,kind:ts.SyntaxKind[node.kind],exported,line:line(node)});
      }
      if(ts.isMethodDeclaration(node)&&name){
        const visibility=modifier(node,ts.SyntaxKind.PrivateKeyword)?"private":
          modifier(node,ts.SyntaxKind.ProtectedKeyword)?"protected":"class-surface";
        methods.push({className:owner,name,visibility,line:line(node)});
      }
      if(ts.isDecorator(node)&&ts.isCallExpression(node.expression)){
        const call=node.expression, decorator=call.expression.getText(source);
        if(routeNames.has(decorator)){
          decorators.push({decorator,argument:call.arguments.map(x=>x.getText(source)).join(", ").slice(0,200),line:line(node)});
        }
      }
      if(ts.isStringLiteral(node)&&eventName.test(node.text)){
        events.push({name:node.text,line:line(node),kind:"versioned-event-literal-candidate"});
      }
      const childOwner=ts.isClassDeclaration(node)&&name?name:owner;
      ts.forEachChild(node,child=>walk(child,childOwner));
    }
    walk(source);
    records.push({file:rel,parseDiagnostics:source.parseDiagnostics.map(d=>({line:source.getLineAndCharacterOfPosition(d.start||0).line+1,message:ts.flattenDiagnosticMessageText(d.messageText," ")})),
      declarations,methods,decorators,events});
  }
  return {mode:"typescript-ast",evidence:"declaration-only; not type-checked, published or deployed",files:records};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length<3)throw Error("Supply one or more relative TS/TSX source paths");
    const ts=parser();
    const result=extract(ts,process.argv.slice(2));
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
    if(result.files.some(f=>f.parseDiagnostics.length))process.exitCode=1;
  }catch(error){
    process.stderr.write(String(error.message||error)+"\n");
    process.exitCode=2;
  }
}
