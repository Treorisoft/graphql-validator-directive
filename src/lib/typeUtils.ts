import { GraphQLInputType, isListType, isNonNullType, isScalarType } from "graphql"


interface ScalarType {
  scalarType: GraphQLInputType
  list?: true
  scalarNotNull?: true
  listNotNull?: true
}

export function getScalarType (fieldConfig: GraphQLInputType): ScalarType {
  if (isScalarType(fieldConfig)) {
    return { scalarType: fieldConfig }
  } else if (isListType(fieldConfig)) {
    return { ...getScalarType(fieldConfig.ofType), list: true }
  } else if (isNonNullType(fieldConfig) && isScalarType(fieldConfig.ofType)) {
    return { scalarType: fieldConfig.ofType, scalarNotNull: true }
  } else if (isNonNullType(fieldConfig)) {
    // this _had_ .ofType.ofType - valid??
    return { ...getScalarType(fieldConfig.ofType), list: true, listNotNull: true }
  } else {
    throw new Error(`Not a valid scalar type: ${fieldConfig.toString()}`)
  }
}