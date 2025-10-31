import { GetUnVerifiedClaims } from "./jwtutil.js";
import { APIResponseUnauthorized } from "./responseutil.js";

// Middleware function to authenticate account token from cookie
export const AuthenticateAccountTokenFromCookie = (req, res, next) => {
    try {
        // Extract token from cookie headers
        let token = req.headers["Cookie"] || req.headers["cookie"];
        req.cookie = token;
        
        // Check if token exists
        if (!token || token.trim() === '') {
            APIResponseUnauthorized(
                req,
                res,
                "TOKEN_REQUIRED",
                "Token is required"
            );
            return;
        }

        // Handle multiple cookies by finding the token cookie
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

        // Remove "token=" prefix if present
        if (token.startsWith("token=")) {
            token = token.substring(6);
        }

        // Verify and decode the JWT token
        const claims = GetUnVerifiedClaims(token);
        if (!claims) {
            APIResponseUnauthorized(req, res, "INVALID_TOKEN", "Invalid token");
            return;
        }

        // Validate required claims in token
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

        // Set token and claims in request object for use in subsequent middleware
        req.token = token;
        req.userid = claims.userid;
        req.accountid = claims.accountid;

        // Set cache control headers
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Pragma", "no-cache");

        // Continue to next middleware
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
