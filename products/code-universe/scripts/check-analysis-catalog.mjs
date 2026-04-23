#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const productRoot = root.endsWith("products/code-universe") ? root : path.join(root, "products/code-universe");
const srcRoot = path.join(productRoot, "src/features");

const failures = [];
const warnings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\/view\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function propName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function unwrap(expr) {
  let node = expr;
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node) || ts.isParenthesizedExpression(node)) {
    node = node.expression;
  }
  return node;
}

function literal(expr) {
  const node = unwrap(expr);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal).filter((v) => v !== undefined);
  if (ts.isObjectLiteralExpression(node)) {
    const obj = {};
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p)) continue;
      const key = propName(p.name);
      if (!key) continue;
      obj[key] = literal(p.initializer);
    }
    return obj;
  }
  return undefined;
}

function hasProperty(objectLiteral, key) {
  return objectLiteral.properties.some((p) => ts.isPropertyAssignment(p) && propName(p.name) === key);
}

function findDescriptorObjects(file) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const descriptors = [];

  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(init) && hasProperty(init, "id") && hasProperty(init, "Component")) {
        const obj = literal(init);
        if (obj && typeof obj.id === "string") {
          descriptors.push({ file, name: node.name.getText(sf), obj });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return descriptors;
}

function hasArrayIncluding(value, item) {
  return Array.isArray(value) && value.includes(item);
}

function location(desc) {
  return path.relative(root, desc.file);
}

const descriptors = walk(srcRoot).flatMap(findDescriptorObjects);
const primarySeen = new Map();
let taxonomized = 0;
let hygieneDebt = 0;

for (const desc of descriptors) {
  const d = desc.obj;
  const loc = location(desc);
  for (const required of ["id", "label", "glyph", "hint", "tech", "usecase", "category", "contexts", "order"]) {
    if (d[required] === undefined) failures.push(`${loc}: ${d.id ?? desc.name} missing descriptor.${required}`);
  }

  if (!d.taxonomy) {
    hygieneDebt += 1;
    warnings.push(`${loc}: ${d.id} has no taxonomy; treated as legacy hygiene debt`);
    continue;
  }
  taxonomized += 1;

  const taxonomy = d.taxonomy;
  const primary = taxonomy.primary ?? {};
  for (const key of ["domain", "scope", "intent"]) {
    if (!primary[key]) failures.push(`${loc}: ${d.id} missing taxonomy.primary.${key}`);
  }
  if (!hasArrayIncluding(taxonomy.scopes, primary.scope)) failures.push(`${loc}: ${d.id} taxonomy.scopes must include primary.scope`);
  if (!hasArrayIncluding(taxonomy.intents, primary.intent)) failures.push(`${loc}: ${d.id} taxonomy.intents must include primary.intent`);
  if (taxonomy.domains && !taxonomy.domains.includes(primary.domain)) failures.push(`${loc}: ${d.id} taxonomy.domains must include primary.domain`);
  for (const field of ["personas", "surfaces", "maturity", "signal"]) {
    if (taxonomy[field] === undefined) failures.push(`${loc}: ${d.id} missing taxonomy.${field}`);
  }
  if (!taxonomy.signal?.determinism) failures.push(`${loc}: ${d.id} missing taxonomy.signal.determinism`);
  if (!taxonomy.signal?.evidenceLevel) failures.push(`${loc}: ${d.id} missing taxonomy.signal.evidenceLevel`);

  if (!Array.isArray(d.capabilityKinds) || d.capabilityKinds.length === 0) failures.push(`${loc}: ${d.id} missing capabilityKinds`);
  if (!d.decision?.grade) failures.push(`${loc}: ${d.id} missing decision.grade`);
  if (!Array.isArray(d.actions) || d.actions.length === 0) failures.push(`${loc}: ${d.id} missing actions`);

  const grade = d.decision?.grade;
  const evidence = d.decision?.evidenceClass ?? taxonomy.signal?.evidenceLevel;
  const isGate = d.capabilityKinds?.includes("gate-check") || grade === "gating" || grade === "blocking";
  if (isGate) {
    if (!Array.isArray(d.decision?.supports) || d.decision.supports.length === 0) failures.push(`${loc}: ${d.id} gate insight missing decision.supports`);
    if (!evidence || evidence === "none" || evidence === "weak") failures.push(`${loc}: ${d.id} gate insight requires strong/auditable evidence`);
  }
  if (grade === "blocking" && evidence !== "strong" && evidence !== "auditable") failures.push(`${loc}: ${d.id} blocking insight requires strong/auditable evidence`);

  const primaryKey = `${primary.domain}/${primary.scope}/${primary.intent}`;
  const existing = primarySeen.get(primaryKey);
  if (existing) warnings.push(`duplicate primary facet ${primaryKey}: ${existing} + ${d.id}`);
  else primarySeen.set(primaryKey, d.id);
}

console.log(`Analysis catalog hygiene: ${descriptors.length} descriptors · ${taxonomized} taxonomized · ${hygieneDebt} legacy debt`);
for (const warning of warnings.slice(0, 60)) console.warn(`WARN ${warning}`);
if (warnings.length > 60) console.warn(`WARN ... ${warnings.length - 60} more warnings`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
