import { ShieldAlert } from "lucide-react";
import { Unauthenticated } from 'convex/react';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Sign } from "crypto";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";


export const UnauthenticatedView = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-lg bg-muted">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <ShieldAlert  />
          </ItemMedia>

          <ItemContent>
            <ItemTitle>You are not authenticated</ItemTitle>
            <ItemDescription>
              You need to be authenticated to access this page.
            </ItemDescription>
          </ItemContent>

          <ItemActions>
            <SignInButton>
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </ItemActions>
        </Item>
      </div>
    </div>
  )}
