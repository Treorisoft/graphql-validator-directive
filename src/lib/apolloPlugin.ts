import type { ApolloServerPlugin } from '@apollo/server';
import { separateOperations } from 'graphql';
import { validate } from './validate';
import { ValidationOptions } from '../types';
import { UserInputError, ValidationDirectiveError } from './errors';
import { filterInfoErrorFields } from './filterInfoErrorFields';
import { printPath } from './path';

export function createApolloValidationPlugin(options?: ValidationOptions): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext) {
          const { request, document, contextValue, schema } = requestContext;
          const query = request.operationName
            ? separateOperations(document)[request.operationName]
            : document;

          const errors = await validate(
            schema,
            query,
            contextValue,
            request.variables,
            request.operationName,
            options
          );

          if (errors.length) {
            let throwableErrors: ValidationDirectiveError[] = [];
            let ignorableErrors: ValidationDirectiveError[] = [];
            errors.forEach(err => {
              // if throwable, or top-level (mutation/query)
              if (err.throwable || err.fieldPaths.some(p => !p.prev)) {
                throwableErrors.push(err);
              }
              else {
                ignorableErrors.push(err);
              }
            });
            (requestContext as any).validation_warnings = ignorableErrors;

            if (throwableErrors.length) {
              if (throwableErrors.length === 1) {
                throw throwableErrors[0];
              }

              
              let errorMessages = errors.map(err => {
                let fieldsAffected = err.fieldPaths.map(path => printPath(path));
                return `${err.message} (${fieldsAffected.join(', ')})`;
              });
              throw new UserInputError(errorMessages.join("\n"));
            }
          }
        },
        async executionDidStart(requestContext) {
          return {
            willResolveField({ info }) {
              filterInfoErrorFields(info, (requestContext as any).validation_warnings);
            }
          }
        },
        async willSendResponse(requestContext) {
          let warnings: ValidationDirectiveError[] = (requestContext as any).validation_warnings ?? [];
          if (warnings.length) {
            const { body } = requestContext.response;
            let formattedWarnings = warnings.map(err => ({
              message: err.message,
              fields: err.fieldPaths.map(p => printPath(p))
            }))
            if (body.kind === 'single') {
              if (!body.singleResult.extensions) {
                body.singleResult.extensions = {};
              }
              body.singleResult.extensions.validation_warnings = formattedWarnings;
            }
            else {
              if (!body.initialResult.extensions) {
                body.initialResult.extensions = {};
              }
              body.initialResult.extensions.validation_warnings = formattedWarnings;
            }
          }
        }
      }
    },
    
  };
}