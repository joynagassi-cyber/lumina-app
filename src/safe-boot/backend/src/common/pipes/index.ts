import {
  ArgumentMetadata,
  PipeTransform,
  BadRequestException,
  Injectable,
} from "@nestjs/common";

/**
 * Base validation pipe skeleton — extends class-validator rules.
 */
@Injectable()
export class BasePipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    // TODO: Implement domain-specific validation
    return value;
  }
}
