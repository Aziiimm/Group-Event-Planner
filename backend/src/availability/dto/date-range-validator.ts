import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsDateRangeValid(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isDateRangeValid',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const startDate = obj.start_date;
          const endDate = obj.end_date;

          if (!startDate || !endDate) {
            return true; // Let other validators handle required checks
          }

          const start = new Date(startDate);
          const end = new Date(endDate);

          return start <= end;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Start date must be before or equal to end date';
        },
      },
    });
  };
}

