import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // Create nemiScope table
    await knex.schema.createTable('nemiScope', (table) => {
        table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('name').notNullable();
        table.string('label').notNullable();
        table.string('version').notNullable();
    });

    // Create nemiTables table
    await knex.schema.createTable('nemiTables', (table) => {
        table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.uuid('scope').references('nid').inTable('nemiScope').onDelete('CASCADE');
        table.string('label').notNullable();
    });

    // Create nemiColumns table
    await knex.schema.createTable('nemiColumns', (table) => {
        table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.uuid('table').references('nid').inTable('nemiTables').onDelete('CASCADE');
        table.uuid('scope').references('nid').inTable('nemiScope').onDelete('CASCADE');
        table.string('name').notNullable();
        table.string('type').notNullable();
        table.string('label').notNullable();
    });

    // Create businessRules table
    await knex.schema.createTable('businessRules', (table) => {
        table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('name').notNullable();
        table.uuid('table').references('nid').inTable('nemiTables').onDelete('CASCADE');
        table.uuid('scope').references('nid').inTable('nemiScope').onDelete('CASCADE');
        table.text('script').notNullable();
        table.string('when').notNullable(); // before, after
        table.string('operation').notNullable(); // insert, update, etc.
        table.integer('order').notNullable();
    });

    // Create scriptModules table
    await knex.schema.createTable('scriptModules', (table) => {
        table.uuid('nid').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.uuid('scope').references('nid').inTable('nemiScope').onDelete('CASCADE');
        table.string('name').notNullable();
        table.text('script').notNullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('scriptModules');
    await knex.schema.dropTableIfExists('businessRules');
    await knex.schema.dropTableIfExists('nemiColumns');
    await knex.schema.dropTableIfExists('nemiTables');
    await knex.schema.dropTableIfExists('nemiScope');
}