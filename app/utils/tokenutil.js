import { GetUnVerifiedClaims } from "./jwtutil.js";
import { APIResponseUnauthorized } from "./responseutil.js";

export const AuthenticateAccountTokenFromCookie = (req, res, next) => {
    try {
        let token = req.headers["Cookie"] || req.headers["cookie"];
        req.cookie = token;
        
        if (!token || token.trim() === '') {
            APIResponseUnauthorized(
                req,
                res,
                "TOKEN_REQUIRED",
                "Token is required"
            );
            return;
        }

        // handle multiple cookies
        if (token.includes(";")) {
            const cookies = token.split(";");
            for (let eachcookie of cookies) {
                eachcookie = eachcookie.trim();
                if (eachcookie.startsWith("token=")) {
                token = eachcookie.substring(6);
                break;
                }
            }
        }

        if (token.startsWith("token=")) {
            token = token.substring(6);
        }

        const claims = GetUnVerifiedClaims(token);
        if (!claims) {
            APIResponseUnauthorized(req, res, "INVALID_TOKEN", "Invalid token");
            return;
        }

        if (!claims.userid) {
            APIResponseUnauthorized(
                req,
                res,
                "INVALID_TOKEN",
                "User ID is missing in token"
            );
            return;
        }

        if (!claims.accountid) {
            APIResponseUnauthorized(
                req,
                res,
                "INVALID_TOKEN",
                "Account ID is missing in token"
            );
            return;
        }

        req.token = token;
        req.userid = claims.userid;
        req.accountid = claims.accountid;

        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Pragma", "no-cache");

        next();
    } catch (error) {
        console.log("Token validation error:", error);
        APIResponseUnauthorized(
            req,
            res,
            "INVALID_TOKEN",
            "Account token validation failed"
        );
    }
};
