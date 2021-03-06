// A datastore takes an adaptor and some DB config settings to manage a DB connection
class Datastore {
  constructor(args) {
    const { Adapter, config } = Object.assign(
      { Adapter: null, config: {} },
      args
    );

    if (!Adapter) throw new Error('missing Adapter reference for Datastore');
    this.adapter = new Adapter({ config });
  }

  async find(ModelDefinition, query, options) {
    if (!ModelDefinition)
      throw new Error('Datastore::find() called without a Model Definition');

    // TODO: parse find query into more managable format
    const values = await this.adapter.find(
      ModelDefinition.name,
      query,
      options
    );

    return Object.entries(values).map(([, { value, ...$ }]) => {
      const model = new ModelDefinition(value, options);
      Object.assign(model, { $ });
      return model;
    });
  }

  async count(ModelDefinition, query, options) {
    if (!ModelDefinition)
      throw new Error('Datastore::count() called without a Model Definition');

    const count = await this.adapter.count(
      ModelDefinition.name,
      query,
      options
    );
    return count;
  }

  async load(model, paths = []) {
    // console.log('Datastore::load()', {
    //   modelName: model.modelName,
    //   id: model.id(),
    //   paths,
    //   loaded: model.loaded(),
    // });
    if (!model) throw new Error('Datastore::load() called without a model');
    if (!model.loaded()) {
      // TODO: may be able to replace this with path '.'
      const { value, ...$ } = await this.adapter.load(model);
      Object.assign(model, value, { $ });
    }
    await Promise.all(
      paths.map(path => {
        const modelField = model[path];
        return this.adapter
          .load(modelField)
          .then(({ value, ...$ }) => Object.assign(modelField, value, { $ }));
      })
    );
    return model;
  }

  async save(model) {
    if (!model) throw new Error('Datastore::save() called without a model');
    const $ = await this.adapter.save(model);
    Object.assign(model, { $ });
    return model;
  }

  async remove(model) {
    if (!model) throw new Error('Datastore::remove() called without a model');
    const $ = await this.adapter.remove(model);
    Object.assign(model, { $ });
    return model;
  }

  async flush() {
    return this.adapter.flush();
  }
}

module.exports = Datastore;
