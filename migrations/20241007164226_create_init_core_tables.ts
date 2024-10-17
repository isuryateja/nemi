import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {


    // Create nemiUser table
    await knex.schema.createTable('nemi_user', (table) => {
        table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('username').notNullable();
        table.string('firstname').notNullable();
        table.string('middlename');
        table.string('lastname').notNullable();
        table.string('gender').notNullable(); // choice
        table.string('email').notNullable();
        table.string('password').notNullable(); // hashed password
        table.string('designation');
        table.boolean('active').defaultTo(true);
  });

  // Create nemiScope table
  await knex.schema.createTable('nemi_scope', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('name').notNullable();
    table.string('label').notNullable();
    table.string('version').notNullable();
    table.uuid('created_by').references('nid').inTable('nemi_user').onDelete('SET NULL');
  });


  // Create nemiTables table
  await knex.schema.createTable('nemi_table', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.string('label').notNullable();
    table.uuid('created_by').references('nid').inTable('nemi_user').onDelete('SET NULL');
  });

  // Create nemiColumns table
  await knex.schema.createTable('nemi_column', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.uuid('table').references('nid').inTable('nemi_table').onDelete('CASCADE');
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('type').notNullable();
    table.string('label').notNullable();
    table.uuid('created_by').references('nid').inTable('nemi_user').onDelete('SET NULL');
  });

  // Create businessRules table
  await knex.schema.createTable('nemi_business_rule', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('name').notNullable();
    table.uuid('table').references('nid').inTable('nemi_table').onDelete('CASCADE');
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.text('script').notNullable();
    table.string('when').notNullable(); // before, after
    table.string('operation').notNullable(); // insert, update, etc.
    table.integer('order').notNullable();
    table.uuid('created_by').references('nid').inTable('nemi_user').onDelete('SET NULL');
    table.boolean('active').defaultTo(true);
  });

  // Create scriptModules table
  await knex.schema.createTable('nemi_script_module', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('script').notNullable();
    table.uuid('created_by').references('nid').inTable('nemi_user').onDelete('SET NULL');
  });



  // Create nemiRole table
  await knex.schema.createTable('nemi_role', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('description').notNullable();
    table.string('label').notNullable();
    table.uuid('contains').references('nid').inTable('nemi_role').onDelete('SET NULL');
    table.boolean('active').defaultTo(true);
    table.uuid('created_by').references('nid').inTable('nemi_user').onDelete('SET NULL');
  });

  // Create n_user_role table (many-to-many relation between users and roles)
  await knex.schema.createTable('n_user_role', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.uuid('user').references('nid').inTable('nemi_user').onDelete('CASCADE');
    table.uuid('role').references('nid').inTable('nemi_role').onDelete('CASCADE');
  });

  // Create nemiAccessPolicy table
  await knex.schema.createTable('nemi_access_policy', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.uuid('table').references('nid').inTable('nemi_table').onDelete('CASCADE');
    table.uuid('column').references('nid').inTable('nemi_column').onDelete('CASCADE');
    table.text('script').notNullable();
    table.boolean('active').defaultTo(true);
    table.uuid('created_by').references('nid').inTable('nemi_user').onDelete('SET NULL');
  });

  // Create n_acp_role table (many-to-many relation between access policies and roles)
  await knex.schema.createTable('n_acp_role', (table) => {
    table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.uuid('scope').references('nid').inTable('nemi_scope').onDelete('CASCADE');
    table.uuid('access_policy').references('nid').inTable('nemi_access_policy').onDelete('CASCADE');
    table.uuid('role').references('nid').inTable('nemi_role').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('n_acp_role');
  await knex.schema.dropTableIfExists('nemi_access_policy');
  await knex.schema.dropTableIfExists('n_user_role');
  await knex.schema.dropTableIfExists('nemi_role');
  await knex.schema.dropTableIfExists('nemi_user');
  await knex.schema.dropTableIfExists('nemi_script_module');
  await knex.schema.dropTableIfExists('nemi_business_rule');
  await knex.schema.dropTableIfExists('nemi_column');
  await knex.schema.dropTableIfExists('nemi_table');
  await knex.schema.dropTableIfExists('nemi_scope');
}