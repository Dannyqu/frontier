const _ = require('lodash');
const uuid = require('uuid');

const Field = require('./Field');

// A Model takes a definition object
class Model {
  static validate() {
    const instance = new this();
    return !!instance;
  }

  static ref(id, options) {
    return new this({ id }, { ...options });
  }

  static async getById(id, options = {}) {
    const repository = options.repository || this.prototype.repository;
    if (!repository)
      throw new Error(`${this.name}::getById() called without a repository`);

    const model = this.ref(id, options);
    return model.load();
  }

  static async find(query, options = {}) {
    const repository = options.repository || this.prototype.repository;
    if (!repository)
      throw new Error(`${this.name}::find() called without a repository`);

    return repository.find(this, query, options);
  }

  static async findOne(query, options = {}) {
    const repository = options.repository || this.prototype.repository;
    if (!repository)
      throw new Error(`${this.name}::findOne() called without a repository`);

    return repository.findOne(this, query, options);
  }

  constructor(data = {}, options) {
    const { repository } = Object.assign({}, options);
    this.modelName = this.constructor.name.replace(/Repository$/, '');
    this.schema = this.constructor.schema();
    if (repository) this.repository = repository;
    if (!this.schema.id)
      Object.assign(this.schema, {
        id: { type: 'string', default: () => uuid.v4(), required: 'true' },
      });
    if (typeof this.schema.id.default !== 'function')
      throw new Error(
        `Model '${this.modelName}' is missing a default function for Field 'id'`
      );

    Field.prototype.repository = this.repository;
    this.fields = Object.entries(this.schema).reduce(
      (result, [name, definition]) => ({
        ...result,
        [name]: new Field({
          name,
          definition,
          value: data[name],
        }),
      }),
      {}
    );

    const schemaKeys = Object.keys(this.schema);
    return new Proxy(this, {
      get(target, key) {
        if (schemaKeys.includes(key))
          return Reflect.get(target.fields[key], 'value');
        return Reflect.get(target, key);
      },
      set(target, key, value) {
        if (schemaKeys.includes(key))
          return Reflect.set(target.fields[key], 'value', value);
        return Reflect.set(target, key, value);
      },
    });
  }

  toJSON(model = this) {
    return Object.entries(model.fields).reduce(
      (result, [name, field]) => {
        if (name === 'meta') return result;
        const value = this[name];
        if (value) {
          if (value.constructor === Array) {
            return {
              ...result,
              [name]: value.map(v => v.toJSON()),
            };
          }
          if (typeof value === 'object') {
            if (value.constructor === Date)
              return { ...result, [name]: value.toJSON() };
            if (
              field.type === 'Mixed' ||
              field.type.constructor === Field.ModelRef
            ) {
              return { ...result, [name]: value.toJSON() };
            }
          }
        }
        return { ...result, [name]: value };
      },
      { meta: { ...model.schema.meta, type: this.modelName } }
    );
  }

  loaded() {
    return _.has(this, '$.cas');
  }

  async save(options = {}) {
    const repo = options.repository || this.repository;
    if (!repo)
      throw new Error(`${this.modelName}::save() called without a repository`);
    return repo.save(this);
  }

  async load(options = {}) {
    const repo = options.repository || this.repository;
    if (!repo)
      throw new Error(`${this.modelName}::load() called without a repository`);
    return repo.load(this);
  }

  async remove(options = {}) {
    const repo = options.repository || this.repository;
    if (!repo)
      throw new Error(`${this.modelName}::load() called without a repository`);
    await repo.remove(this);
    this.loaded = false;
    return this;
  }
}

module.exports = Model;
