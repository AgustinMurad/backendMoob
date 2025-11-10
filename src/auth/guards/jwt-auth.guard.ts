import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Aquí puedes añadir lógica personalizada antes de la validación
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Puedes lanzar una excepción personalizada aquí
    if (err || !user) {
      throw err || new Error('Usuario no autorizado');
    }
    return user;
  }
}
