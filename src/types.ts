
export type VariableValues = { [name: string]: any };

export interface ValidationDirectiveRuleOptions<TArgs = Record<string, any>> {
  name: string
  args?: TArgs
}

// For future customization use
export interface ValidationOptions {
  
}