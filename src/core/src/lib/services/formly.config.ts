import { Injectable, InjectionToken, ComponentRef } from '@angular/core';
import { FieldType } from './../templates/field.type';
import { reverseDeepMerge, defineHiddenProp } from './../utils';
import {
  FormlyFieldConfig,
  FormlyFieldConfigCache,
  ConfigOption,
  TypeOption,
  ValidatorOption,
  WrapperOption,
  FormlyExtension,
  ValidationMessageOption,
} from '../models';

export const FORMLY_CONFIG = new InjectionToken<ConfigOption[]>('FORMLY_CONFIG');

/**
 * Maintains list of formly field directive types. This can be used to register new field templates.
 */
@Injectable({ providedIn: 'root' })
export class FormlyConfig {
  types: { [name: string]: TypeOption } = {};
  validators: { [name: string]: ValidatorOption } = {};
  wrappers: { [name: string]: WrapperOption } = {};
  messages: { [name: string]: ValidationMessageOption['message'] } = {};
  extras: ConfigOption['extras'] = {
    checkExpressionOn: 'changeDetectionCheck',
    lazyRender: true,
    resetFieldOnHide: true,
    showError(field: FieldType) {
      return (
        field.formControl &&
        field.formControl.invalid &&
        (field.formControl.touched ||
          (field.options.parentForm && field.options.parentForm.submitted) ||
          !!(field.field.validation && field.field.validation.show))
      );
    },
  };
  extensions: { [name: string]: FormlyExtension } = {};

  addConfig(config: ConfigOption) {
    if (config.types) {
      config.types.forEach((type) => this.setType(type));
    }
    if (config.validators) {
      config.validators.forEach((validator) => this.setValidator(validator));
    }
    if (config.wrappers) {
      config.wrappers.forEach((wrapper) => this.setWrapper(wrapper));
    }
    if (config.validationMessages) {
      config.validationMessages.forEach((validation) => this.addValidatorMessage(validation.name, validation.message));
    }
    if (config.extensions) {
      config.extensions.forEach((c) => (this.extensions[c.name] = c.extension));
    }
    if (config.extras) {
      this.extras = { ...this.extras, ...config.extras };
    }
  }

  setType(options: TypeOption | TypeOption[]) {
    if (Array.isArray(options)) {
      options.forEach((option) => this.setType(option));
    } else {
      if (!this.types[options.name]) {
        this.types[options.name] = <TypeOption>{ name: options.name };
      }

      ['component', 'extends', 'defaultOptions'].forEach((prop) => {
        if (options.hasOwnProperty(prop)) {
          this.types[options.name][prop] = options[prop];
        }
      });

      if (options.wrappers) {
        options.wrappers.forEach((wrapper) => this.setTypeWrapper(options.name, wrapper));
      }
    }
  }

  getType(name: string): TypeOption {
    if (!this.types[name]) {
      throw new Error(
        `[Formly Error] The type "${name}" could not be found. Please make sure that is registered through the FormlyModule declaration.`,
      );
    }

    this.mergeExtendedType(name);

    return this.types[name];
  }

  getMergedField(field: FormlyFieldConfig = {}): any {
    const type = this.getType(field.type);
    if (type.defaultOptions) {
      reverseDeepMerge(field, type.defaultOptions);
    }

    const extendDefaults = type.extends && this.getType(type.extends).defaultOptions;
    if (extendDefaults) {
      reverseDeepMerge(field, extendDefaults);
    }

    if (field && field.optionsTypes) {
      field.optionsTypes.forEach((option) => {
        const defaultOptions = this.getType(option).defaultOptions;
        if (defaultOptions) {
          reverseDeepMerge(field, defaultOptions);
        }
      });
    }

    const componentRef = this.resolveFieldTypeRef(field);
    if (componentRef && componentRef.instance && componentRef.instance.defaultOptions) {
      reverseDeepMerge(field, componentRef.instance.defaultOptions);
    }

    if (!field.wrappers && type.wrappers) {
      field.wrappers = [...type.wrappers];
    }
  }

  /** @internal */
  resolveFieldTypeRef(field: FormlyFieldConfigCache = {}): ComponentRef<FieldType> {
    if (!field.type) {
      return null;
    }

    const type = this.getType(field.type);
    if (!type.component || type['_componentRef']) {
      return type['_componentRef'];
    }

    const { _resolver, _injector } = field.options;
    if (!_resolver || !_injector) {
      return null;
    }

    const componentRef = _resolver.resolveComponentFactory<FieldType>(type.component).create(_injector);
    defineHiddenProp(type, '_componentRef', componentRef);
    componentRef.destroy();

    return type['_componentRef'];
  }

  setWrapper(options: WrapperOption) {
    this.wrappers[options.name] = options;
    if (options.types) {
      options.types.forEach((type) => {
        this.setTypeWrapper(type, options.name);
      });
    }
  }

  getWrapper(name: string): WrapperOption {
    if (!this.wrappers[name]) {
      throw new Error(
        `[Formly Error] The wrapper "${name}" could not be found. Please make sure that is registered through the FormlyModule declaration.`,
      );
    }

    return this.wrappers[name];
  }

  setTypeWrapper(type: string, name: string) {
    if (!this.types[type]) {
      this.types[type] = <TypeOption>{};
    }
    if (!this.types[type].wrappers) {
      this.types[type].wrappers = [];
    }
    if (this.types[type].wrappers.indexOf(name) === -1) {
      this.types[type].wrappers.push(name);
    }
  }

  setValidator(options: ValidatorOption) {
    this.validators[options.name] = options;
  }

  getValidator(name: string): ValidatorOption {
    if (!this.validators[name]) {
      throw new Error(
        `[Formly Error] The validator "${name}" could not be found. Please make sure that is registered through the FormlyModule declaration.`,
      );
    }

    return this.validators[name];
  }

  addValidatorMessage(name: string, message: ValidationMessageOption['message']) {
    this.messages[name] = message;
  }

  getValidatorMessage(name: string) {
    return this.messages[name];
  }

  private mergeExtendedType(name: string) {
    if (!this.types[name].extends) {
      return;
    }

    const extendedType = this.getType(this.types[name].extends);
    if (!this.types[name].component) {
      this.types[name].component = extendedType.component;
    }

    if (!this.types[name].wrappers) {
      this.types[name].wrappers = extendedType.wrappers;
    }
  }
}
