import type { ValidationOptions, VariableValues } from "../types"

export interface VisitorOptions {
  variables?: VariableValues
  operationName?: string
  pluginOptions?: ValidationOptions
}