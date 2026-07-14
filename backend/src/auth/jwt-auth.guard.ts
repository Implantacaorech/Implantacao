import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** A autorização é sempre validada no backend — o Angular nunca é a única barreira
 * (equivalente ao @before_request _exige_login do Flask). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
