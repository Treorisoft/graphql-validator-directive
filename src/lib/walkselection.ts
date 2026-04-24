import { FieldNode, GraphQLCompositeType, GraphQLField, GraphQLNamedType, GraphQLOutputType, GraphQLResolveInfo, GraphQLString, Kind, SelectionNode, getNamedType, isCompositeType, isInterfaceType, isObjectType, isUnionType } from 'graphql';
import { addPath, Path } from './path';

type WalkedField = {
  node: FieldNode;
  path: Path;
  parentType: GraphQLCompositeType;
  fieldDef?: GraphQLField<any, any>;
  type: GraphQLOutputType;
  namedType: GraphQLNamedType;
};

export type OnFieldCallback = (field: WalkedField) => void | boolean;

export function walkInfoSelections(info: GraphQLResolveInfo, onField: OnFieldCallback) {
  const rootType = getNamedType(info.returnType);
  if (!isCompositeType(rootType)) {
    return;
  }

  for (const fieldNode of info.fieldNodes) {
    if (!fieldNode.selectionSet) {
      continue;
    }

    walkSelectionSet(info, fieldNode.selectionSet.selections, rootType, info.path as Path, onField);
  }
}

function walkSelectionSet(info: GraphQLResolveInfo, selections: readonly SelectionNode[], parentType: GraphQLCompositeType, parentPath: Path, onField: OnFieldCallback) {
  let indexesToRemove: number[] = [];
  for (let i = 0, l = selections.length; i < l; i++) {
    const selection = selections[i];
    if (selection.kind === Kind.FIELD) {
      const fieldName = selection.name.value;
      const responseKey = selection.alias?.value ?? fieldName;
      const fieldPath = addPath(parentPath, {
        key: responseKey,
        typename: parentType.name,
      });

      let fieldDef: GraphQLField<any, any> | undefined;
      let fieldType: GraphQLOutputType;
      let namedType: GraphQLNamedType;

      if (fieldName === '__typename') {
        fieldType = GraphQLString;
        namedType = GraphQLString;
      } else {
        fieldDef = getFieldDef(parentType, fieldName);
        if (!fieldDef) {
          continue;
        }

        fieldType = fieldDef.type;
        namedType = getNamedType(fieldType);
      }

      const fieldResult = onField({
        node: selection,
        path: fieldPath,
        parentType,
        fieldDef,
        type: fieldType,
        namedType,
      });
      if (fieldResult === false) {
        indexesToRemove.push(i);
      }

      if (selection.selectionSet && isCompositeType(namedType)) {
        walkSelectionSet(info, selection.selectionSet.selections, namedType, fieldPath, onField);
      }

      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const fragmentType = selection.typeCondition
        ? info.schema.getType(selection.typeCondition.name.value)
        : parentType;

      if (fragmentType && isCompositeType(fragmentType)) {
        walkSelectionSet(info, selection.selectionSet.selections, fragmentType, parentPath, onField);
      }

      continue;
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = info.fragments[selection.name.value];
      if (!fragment) {
        continue;
      }

      const fragmentType = info.schema.getType(fragment.typeCondition.name.value);
      if (fragmentType && isCompositeType(fragmentType)) {
        walkSelectionSet(info, fragment.selectionSet.selections, fragmentType, parentPath, onField);
      }
    }
  }

  if (indexesToRemove.length) {
    indexesToRemove.sort((a, b) => b - a);
    for (let idx of indexesToRemove) {
      // as any[] because SelectionNode is typed as readonly, but is actually mutable in practice - thankfully since we need it to be
      (selections as any[]).splice(idx, 1);
    }
  }
}

function getFieldDef(parentType: GraphQLCompositeType, fieldName: string): GraphQLField<any, any> | undefined {
  if (isObjectType(parentType) || isInterfaceType(parentType)) {
    return parentType.getFields()[fieldName];
  }

  if (isUnionType(parentType)) {
    return undefined;
  }

  return undefined;
}