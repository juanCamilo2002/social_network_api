import 'reflect-metadata';
import 'dotenv/config';

import { DataSource } from 'typeorm';

import { createDatabaseOptions } from '../config/database.config';
import { validate } from '../config/env.validation';

const env = validate(process.env);

export default new DataSource(createDatabaseOptions(env));
