import { Path } from "@graphql-tools/utils";
import { GraphQLError, GraphQLErrorExtensions, GraphQLErrorOptions } from "graphql";

export class ApolloError extends GraphQLError {
  constructor(message: string, code?: string, originalError?: GraphQLErrorOptions['originalError'], extensions?: GraphQLErrorExtensions) {
    super(message, {
      originalError,
      extensions: {
        ...extensions,
        code,
      },
    });
    this.name = this.constructor.name;
  }
}

export class UserInputError extends ApolloError {
  constructor(message: string, originalError?: GraphQLErrorOptions['originalError'], extensions?: GraphQLErrorExtensions) {
    super(message, 'BAD_USER_INPUT', originalError, extensions);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationDirectiveError extends GraphQLError {
  public throwable: boolean;
  public fieldPaths: Path[];

  constructor(message: string, fields: Path[], throwable: boolean, originalError?: GraphQLErrorOptions['originalError'], extensions?: GraphQLErrorExtensions) {
    super(message, {
      originalError,
      extensions: {
        ...extensions,
        code: 'ERR_GRAPHQL_CONSTRAINT_VALIDATION',
        fields,
      }
    });

    this.throwable = throwable;
    this.fieldPaths = fields;
    this.name = this.constructor.name;
  }
}