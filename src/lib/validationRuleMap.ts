import { ValidationDirectiveRuleOptions } from "../types";
import { ValidationDirectiveRule, ValidationRuleConstructor } from "./validationDirectiveRule";
import hash from 'object-hash';

const RULE_CLASSES: Map<string, ValidationRuleConstructor> = new Map();
const RULE_INSTANCES: Map<string, ValidationDirectiveRule> = new Map();

export type RegisterRulesMap<T extends ValidationRuleConstructor> = {
  [x: string]: T
}

export function registerRules<T extends ValidationRuleConstructor>(rules: RegisterRulesMap<T>) {
  const ruleNames = Object.keys(rules);
  for (let ruleName of ruleNames) {
    if (!RULE_CLASSES.has(ruleName)) {
      RULE_CLASSES.set(ruleName, rules[ruleName]);
    }
  }
}

export function hasRegisteredRule(ruleName: string): boolean {
  return RULE_CLASSES.has(ruleName);
}

export function createRule(options: ValidationDirectiveRuleOptions): ValidationDirectiveRule {
  if (!RULE_CLASSES.has(options.name)) {
    throw new Error(`ValidationRule ${options.name} has not been registered`);
  }

  const ruleHash = hash(options);
  if (!RULE_INSTANCES.has(ruleHash)) {
    const ruleType = RULE_CLASSES.get(options.name)!;
    RULE_INSTANCES.set(ruleHash, new ruleType(options));
  }
  
  return RULE_INSTANCES.get(ruleHash)!;
}