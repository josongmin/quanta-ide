import type { TabAppDescriptor } from "@quanta/shell-contract";
import { ReviewsApp } from "./App";

export const reviewsDescriptor: TabAppDescriptor = {
  id: "reviews",
  label: "Reviews",
  Component: ReviewsApp,
};
