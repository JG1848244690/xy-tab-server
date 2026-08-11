import { createMessageObjectSchema } from "stoker/openapi/schemas";
import * as HttpStatusPhrases from 'stoker/http-status-phrases'


export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND)